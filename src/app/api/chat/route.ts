import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Real-estate AI support agent.
 *
 * Ported from the standalone backend/server.js Express agent (same system
 * prompt, same data/properties.json + data/promotions.json data, same tool
 * set and inquiry-confirmation gate) so the logic that was already built
 * there actually reaches the deployed Next.js site — backend/server.js
 * itself is never deployed (Vercel only builds this app's package.json).
 *
 * One thing could not be ported as-is: backend/server.js kept inquiry state
 * in an in-memory Map keyed by a session cookie. Vercel serverless
 * functions are stateless per invocation, so that Map would reset on every
 * request. Instead, the inquiry state itself is serialized into a signed,
 * httpOnly cookie (signed with ANTHROPIC_API_KEY as key material — this
 * feature already requires that secret to be present, so this avoids
 * introducing a second one) and round-tripped on every request. This keeps
 * the backend-enforced confirmation gate un-bypassable by a client editing
 * the cookie: an invalid/tampered signature is treated as no session.
 */

export const runtime = "nodejs";

// ---- Inquiry state -------------------------------------------------------

interface CustomerDetails {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  unit: string | null;
}

interface InquiryState {
  propertyId: string | null;
  propertyName: string | null;
  inquiryType: string | null;
  customerDetails: CustomerDetails;
  preferredDate: string | null;
  preferredTime: string | null;
  message: string | null;
  promotionId: string | null;
  confirmed: boolean;
  summaryAcknowledged: boolean;
  savedInquiryId: string | null;
  status: string;
  declinedPropertyIds: string[];
}

function createEmptyInquiryState(): InquiryState {
  return {
    propertyId: null,
    propertyName: null,
    inquiryType: null,
    customerDetails: { name: null, email: null, phone: null, address: null, unit: null },
    preferredDate: null,
    preferredTime: null,
    message: null,
    promotionId: null,
    confirmed: false,
    summaryAcknowledged: false,
    savedInquiryId: null,
    status: "draft",
    declinedPropertyIds: [],
  };
}

const SESSION_COOKIE = "inquirySession";

function signingKey(): string {
  return process.env.ANTHROPIC_API_KEY || "nadeem-real-estate-dev-only";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

function encodeInquiryState(state: InquiryState): string {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeInquiryState(cookieValue: string | undefined): InquiryState {
  if (!cookieValue) return createEmptyInquiryState();
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return createEmptyInquiryState();

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return createEmptyInquiryState();
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return { ...createEmptyInquiryState(), ...parsed };
  } catch {
    return createEmptyInquiryState();
  }
}

// ---- Verified data sources ------------------------------------------------

interface Property {
  id: string;
  name: string;
  description: string;
  price: number;
  /** ISO currency code for `price`; omitted means USD (all pre-existing listings). */
  currency?: string;
  location: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  /** Square feet. Omitted for listings only measured in a non-sqft unit — see landSize. */
  area?: number;
  /** Verbatim size label (e.g. "7.5 Marla") for listings not measured in sqft. */
  landSize?: string;
  features: string[];
  images: string[];
  agent: string;
  availability: string;
}

interface Promotion {
  id: string;
  name: string;
  rule: string;
  discountValue: string;
  eligibilityConditions: string;
  active: boolean;
  appliesToFee?: boolean;
  feeDiscountPercent?: number;
}

function readSystemPrompt(): string {
  return fs.readFileSync(path.join(process.cwd(), "prompts", "system-prompt.md"), "utf8");
}

function readProperties(): Property[] {
  const raw = fs.readFileSync(path.join(process.cwd(), "data", "properties.json"), "utf8");
  return JSON.parse(raw).properties;
}

function readPromotions(): Promotion[] {
  const raw = fs.readFileSync(path.join(process.cwd(), "data", "promotions.json"), "utf8");
  return JSON.parse(raw).promotions;
}

const UNAVAILABLE_STATUSES = new Set(["sold", "rented", "unavailable", "off market"]);

function isAvailable(property: Property): boolean {
  const availability = (property.availability || "").toLowerCase();
  return Boolean(availability) && !UNAVAILABLE_STATUSES.has(availability);
}

function getAvailableProperties(): Property[] {
  return readProperties().filter(isAvailable);
}

// Confirmed-inquiry persistence. Vercel serverless functions have an
// ephemeral/read-only-between-invocations filesystem, so this file write is
// not guaranteed to survive across cold starts or deployments — matching
// the same known limitation already documented for /api/contact (which
// also only console.logs, with a TODO to wire up a real database). The
// console.log below is the durable record until that's built; the file
// write is a best-effort local/dev-parity feature.
const INQUIRIES_FILE_PATH = path.join(process.cwd(), "data", "inquiries.json");

function readInquiriesFile(): unknown[] {
  const raw = fs.readFileSync(INQUIRIES_FILE_PATH, "utf8");
  const parsed = raw.trim() ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? parsed : [];
}

function appendInquiryRecord(record: Record<string, unknown>): void {
  console.log("[chat] confirmed inquiry", record);
  try {
    const inquiries = readInquiriesFile();
    inquiries.push(record);
    fs.writeFileSync(INQUIRIES_FILE_PATH, JSON.stringify(inquiries, null, 2) + "\n", "utf8");
  } catch (err) {
    console.error("[chat] failed to persist inquiry to disk (non-fatal on serverless):", err);
  }
}

// ---- Inquiry tool logic (ported 1:1 from backend/server.js) --------------

function addPropertyToInquiry(input: { propertyId?: string }, inquiryState: InquiryState) {
  const propertyId = input && input.propertyId;
  if (!propertyId || typeof propertyId !== "string") {
    return { success: false, error: "propertyId is required." };
  }

  const property = readProperties().find((p) => p.id === propertyId);
  if (!property) {
    return { success: false, error: `No property found with id "${propertyId}".` };
  }

  if (!isAvailable(property)) {
    return {
      success: false,
      error: `"${property.name}" is not currently available (${property.availability}).`,
    };
  }

  inquiryState.propertyId = property.id;
  inquiryState.propertyName = property.name;
  inquiryState.status = "draft";
  inquiryState.confirmed = false;
  inquiryState.summaryAcknowledged = false;
  inquiryState.savedInquiryId = null;

  return {
    success: true,
    property: { id: property.id, name: property.name, availability: property.availability },
    inquiryState,
  };
}

const ALLOWED_INQUIRY_TYPES = new Set(["viewing", "information", "contact"]);
const MIN_PHONE_DIGITS = 7;

function isPlausiblePhoneNumber(phone: string): boolean {
  const digitCount = (phone.match(/\d/g) || []).length;
  return digitCount >= MIN_PHONE_DIGITS;
}

interface UpdateInquiryInput {
  propertyId?: string;
  inquiryType?: string;
  preferredDate?: string;
  preferredTime?: string;
  message?: string;
  promotionId?: string;
  customerDetails?: Partial<CustomerDetails>;
}

function updatePropertyInquiry(input: UpdateInquiryInput, inquiryState: InquiryState) {
  if (!input || typeof input !== "object") {
    return { success: false, error: "No update fields were provided." };
  }

  if (!inquiryState.propertyId && !input.propertyId) {
    return {
      success: false,
      error: "There is no inquiry in progress yet. Use addPropertyToInquiry to start one first.",
    };
  }

  const updates: Partial<InquiryState> = {};

  if (input.propertyId !== undefined) {
    if (typeof input.propertyId !== "string" || !input.propertyId.trim()) {
      return { success: false, error: "propertyId must be a non-empty string." };
    }
    const property = readProperties().find((p) => p.id === input.propertyId);
    if (!property) {
      return { success: false, error: `No property found with id "${input.propertyId}".` };
    }
    if (!isAvailable(property)) {
      return {
        success: false,
        error: `"${property.name}" is not currently available (${property.availability}).`,
      };
    }
    updates.propertyId = property.id;
    updates.propertyName = property.name;
  }

  if (input.inquiryType !== undefined) {
    const inquiryType = typeof input.inquiryType === "string" ? input.inquiryType.toLowerCase() : "";
    if (!ALLOWED_INQUIRY_TYPES.has(inquiryType)) {
      return {
        success: false,
        error: `inquiryType must be one of: ${[...ALLOWED_INQUIRY_TYPES].join(", ")}.`,
      };
    }
    updates.inquiryType = inquiryType;
  }

  if (input.preferredDate !== undefined) {
    if (typeof input.preferredDate !== "string" || !input.preferredDate.trim()) {
      return { success: false, error: "preferredDate must be a non-empty string." };
    }
    updates.preferredDate = input.preferredDate.trim();
  }

  if (input.preferredTime !== undefined) {
    if (typeof input.preferredTime !== "string" || !input.preferredTime.trim()) {
      return { success: false, error: "preferredTime must be a non-empty string." };
    }
    updates.preferredTime = input.preferredTime.trim();
  }

  if (input.message !== undefined) {
    if (typeof input.message !== "string" || !input.message.trim()) {
      return { success: false, error: "message must be a non-empty string." };
    }
    updates.message = input.message.trim();
  }

  if (input.promotionId !== undefined) {
    if (typeof input.promotionId !== "string" || !input.promotionId.trim()) {
      return { success: false, error: "promotionId must be a non-empty string." };
    }
    const { promotion, error } = findEligibleFeePromotion(input.promotionId.trim());
    if (!promotion) {
      return { success: false, error };
    }
    updates.promotionId = promotion.id;
  }

  let customerDetailsUpdates: Partial<CustomerDetails> | null = null;
  if (input.customerDetails !== undefined) {
    const isPlainObject =
      typeof input.customerDetails === "object" &&
      input.customerDetails !== null &&
      !Array.isArray(input.customerDetails);
    if (!isPlainObject) {
      return {
        success: false,
        error: "customerDetails must be an object with name, email, phone, address, and/or unit.",
      };
    }
    customerDetailsUpdates = {};
    for (const field of ["name", "email", "phone", "address", "unit"] as const) {
      const value = input.customerDetails[field];
      if (value !== undefined) {
        if (typeof value !== "string" || !value.trim()) {
          return { success: false, error: `customerDetails.${field} must be a non-empty string.` };
        }
        const trimmed = value.trim();
        if (field === "phone" && !isPlausiblePhoneNumber(trimmed)) {
          return {
            success: false,
            error: "That phone number doesn't look valid. Please provide it again.",
          };
        }
        customerDetailsUpdates[field] = trimmed;
      }
    }
    if (Object.keys(customerDetailsUpdates).length === 0) {
      return {
        success: false,
        error: "customerDetails must include at least one of name, email, phone, address, or unit.",
      };
    }
  }

  if (Object.keys(updates).length === 0 && !customerDetailsUpdates) {
    return { success: false, error: "No recognized update fields were provided." };
  }

  Object.assign(inquiryState, updates);
  if (customerDetailsUpdates) {
    Object.assign(inquiryState.customerDetails, customerDetailsUpdates);
  }

  // Any successful update invalidates whatever summary was last shown, so
  // the confirmation gate (see confirmInquiry) requires a fresh
  // getInquiryConfirmationSummary call — and a new explicit confirmation —
  // before this inquiry can be confirmed again.
  inquiryState.summaryAcknowledged = false;
  inquiryState.savedInquiryId = null;
  if (inquiryState.confirmed) {
    inquiryState.confirmed = false;
    inquiryState.status = "draft";
  }

  return { success: true, inquiryState };
}

function removePropertyFromInquiry(input: { propertyId?: string }, inquiryState: InquiryState) {
  const propertyId = input && input.propertyId;
  if (!propertyId || typeof propertyId !== "string") {
    return { success: false, error: "propertyId is required." };
  }

  const property = readProperties().find((p) => p.id === propertyId);
  if (!property) {
    return { success: false, error: `No property found with id "${propertyId}".` };
  }

  if (inquiryState.propertyId !== propertyId) {
    return { success: false, error: `"${property.name}" is not currently part of this inquiry.` };
  }

  inquiryState.propertyId = null;
  inquiryState.propertyName = null;
  inquiryState.status = "draft";
  inquiryState.confirmed = false;
  inquiryState.summaryAcknowledged = false;
  inquiryState.savedInquiryId = null;

  return { success: true, removedPropertyId: property.id, inquiryState };
}

function getInquiryRequirements(inquiryState: InquiryState) {
  const customerName = inquiryState.customerDetails.name || null;
  const customerPhone = inquiryState.customerDetails.phone || null;

  const missingRequired: string[] = [];
  if (!inquiryState.propertyId) missingRequired.push("propertyId");
  if (!inquiryState.inquiryType) missingRequired.push("inquiryType");
  if (!customerName) missingRequired.push("customerName");
  if (!customerPhone) missingRequired.push("customerPhone");

  return {
    propertyId: inquiryState.propertyId,
    propertyName: inquiryState.propertyName,
    inquiryType: inquiryState.inquiryType,
    preferredDate: inquiryState.preferredDate,
    preferredTime: inquiryState.preferredTime,
    customerName,
    customerPhone,
    customerAddress: inquiryState.customerDetails.address || null,
    customerUnit: inquiryState.customerDetails.unit || null,
    message: inquiryState.message,
    promotionId: inquiryState.promotionId || null,
    missingRequired,
    readyToSubmit: missingRequired.length === 0,
    notes:
      "inquiryType must be one of: viewing, information, contact — ask the user which kind of inquiry " +
      "this is if it's still missing; never guess or default it. preferredTime, customerAddress, " +
      "customerUnit, message/viewing instructions, and promotionId are optional and never block " +
      "readiness — only ask for them if genuinely relevant, and never invent them. Only ask the user " +
      "for fields listed in missingRequired — never ask again for anything already set here (including " +
      "the property's own address/location, which always comes from the verified property data, never " +
      "from the customer).",
  };
}

function viewInquiry(inquiryState: InquiryState) {
  return {
    propertyId: inquiryState.propertyId,
    propertyName: inquiryState.propertyName,
    inquiryType: inquiryState.inquiryType,
    preferredDate: inquiryState.preferredDate,
    preferredTime: inquiryState.preferredTime,
    customerDetails: { ...inquiryState.customerDetails },
    message: inquiryState.message,
    status: inquiryState.status,
    confirmed: inquiryState.confirmed,
    inquiryId: inquiryState.savedInquiryId,
  };
}

function getInquiryConfirmationSummary(inquiryState: InquiryState) {
  const requirements = getInquiryRequirements(inquiryState);

  let property: Property | null = null;
  if (inquiryState.propertyId) {
    property = readProperties().find((p) => p.id === inquiryState.propertyId) || null;
  }

  let promotion: { id: string; name: string; discountValue: string; eligibilityStatus: string } | null = null;
  if (inquiryState.promotionId) {
    const resolved = findEligibleFeePromotion(inquiryState.promotionId);
    if (resolved.promotion) {
      promotion = {
        id: resolved.promotion.id,
        name: resolved.promotion.name,
        discountValue: resolved.promotion.discountValue,
        eligibilityStatus: "active and eligible",
      };
    }
  }

  const fee = calculateInquiryFee({}, inquiryState);

  // Arms the confirmation gate enforced by confirmInquiry: only a genuinely
  // complete summary (readyToSubmit) counts as "the customer has had the
  // chance to review it". Any subsequent change disarms it again.
  inquiryState.summaryAcknowledged = requirements.readyToSubmit;

  return {
    readyForConfirmation: requirements.readyToSubmit,
    missingRequired: requirements.missingRequired,
    confirmed: inquiryState.confirmed,
    summary: {
      property: property && {
        id: property.id,
        name: property.name,
        location: property.location,
        propertyType: property.propertyType,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        area: property.area,
        listingPrice: property.price,
      },
      inquiryType: inquiryState.inquiryType,
      preferredDate: inquiryState.preferredDate,
      preferredTime: inquiryState.preferredTime,
      customerName: requirements.customerName,
      customerPhone: requirements.customerPhone,
      customerUnit: requirements.customerUnit,
      instructions: inquiryState.message,
      promotion,
      fees: {
        baseFee: fee.baseFee,
        tax: fee.tax,
        discount: fee.discount,
        finalFee: fee.finalFee,
        currency: fee.currency,
        hasApplicableFee: fee.hasApplicableFee,
      },
    },
    notes:
      "Only present this summary once readyForConfirmation is true; if missingRequired is non-empty, " +
      "ask only for those fields first, then call this again. Show only the non-null fields — never " +
      "invent a value for a null one. property fields are the verified data from data/properties.json; " +
      "if property is null, say the details aren't available rather than guessing, and never ask the " +
      "customer to supply the property's own address. property.listingPrice is the property's verified " +
      "listing price — always label it as the listing price, never as an amount due or payable total; " +
      "the only amount actually owed is fees.finalFee. This is a real-estate inquiry, not an order: " +
      "never mention quantities, cart items, or delivery. promotion is included only when a promotion " +
      "the customer applied via updatePropertyInquiry is still active and eligible — if it is null, do " +
      "not mention any promotion even if the customer previously named one. fees are the exact " +
      "deterministic values returned by the backend calculation — never recompute, round, or adjust " +
      "them yourself; if hasApplicableFee is false, tell the customer there is no inquiry fee rather " +
      "than presenting 0 as if it were a real total. After showing this summary, you must get a clear, " +
      "explicit confirmation (e.g. 'yes', 'confirm', 'that's correct') before calling confirmInquiry — " +
      "vague replies like 'okay' or 'sounds good' are not sufficient, and silence is never confirmation. " +
      "If the customer asks to change something, call updatePropertyInquiry or removePropertyFromInquiry " +
      "for only that change, then call this tool again and get explicit re-confirmation before proceeding.",
  };
}

function confirmInquiry(inquiryState: InquiryState) {
  const requirements = getInquiryRequirements(inquiryState);
  if (!requirements.readyToSubmit) {
    return {
      success: false,
      error: "The inquiry is missing required information and cannot be confirmed yet.",
      missingRequired: requirements.missingRequired,
    };
  }

  const property = readProperties().find((p) => p.id === inquiryState.propertyId);
  if (!property) {
    return { success: false, error: "The selected property could not be found in the current listings." };
  }
  if (!isAvailable(property)) {
    return {
      success: false,
      error: `"${property.name}" is no longer available (${property.availability}). Please choose a different property before confirming.`,
    };
  }

  // Backend-enforced confirmation gate: this can only succeed if
  // getInquiryConfirmationSummary was called for the inquiry in its
  // *current* form. Any modification since then clears this flag.
  if (!inquiryState.summaryAcknowledged) {
    return {
      success: false,
      error:
        "The complete confirmation summary hasn't been shown for the inquiry in its current form yet. " +
        "Call getInquiryConfirmationSummary, show it to the customer, and get their explicit " +
        "confirmation before calling this again.",
    };
  }

  // Idempotency: don't write a second record for the same confirmation.
  if (inquiryState.confirmed && inquiryState.savedInquiryId) {
    return { success: true, alreadySubmitted: true, inquiryId: inquiryState.savedInquiryId, inquiryState };
  }

  const fee = calculateInquiryFee({}, inquiryState);
  const appliedPromotion = inquiryState.promotionId
    ? findEligibleFeePromotion(inquiryState.promotionId).promotion
    : null;

  const inquiryId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const record = {
    inquiryId,
    timestamp,
    status: "NEW",
    propertyId: property.id,
    inquiryType: inquiryState.inquiryType,
    preferredDate: inquiryState.preferredDate,
    preferredTime: inquiryState.preferredTime,
    customerDetails: { ...inquiryState.customerDetails },
    message: inquiryState.message,
    promotionId: appliedPromotion ? appliedPromotion.id : null,
    fee: { baseFee: fee.baseFee, tax: fee.tax, discount: fee.discount, finalFee: fee.finalFee, currency: fee.currency },
    confirmed: true,
  };

  appendInquiryRecord(record);

  inquiryState.confirmed = true;
  inquiryState.status = "confirmed";
  inquiryState.savedInquiryId = inquiryId;

  return { success: true, inquiryId, timestamp, status: "NEW", inquiryState };
}

const RESIDENTIAL_PROPERTY_TYPES = new Set(["apartment", "house", "villa", "townhouse", "condo"]);

function propertyCategory(property: Property): "residential" | "commercial" {
  const type = (property.propertyType || "").toLowerCase();
  return RESIDENTIAL_PROPERTY_TYPES.has(type) ? "residential" : "commercial";
}

const MIN_RELEVANCE_SCORE = 3;

function scorePropertySimilarity(candidate: Property, reference: Property): number {
  let score = 0;

  if (candidate.propertyType && candidate.propertyType === reference.propertyType) score += 3;

  if (candidate.availability && candidate.availability === reference.availability) score += 2;

  if (candidate.location && reference.location) {
    const candidateLocation = candidate.location.toLowerCase();
    const referenceLocation = reference.location.toLowerCase();
    if (candidateLocation === referenceLocation) {
      score += 3;
    } else {
      const candidateParts = candidateLocation.split(",").map((part) => part.trim());
      const referenceParts = referenceLocation.split(",").map((part) => part.trim());
      if (candidateParts.some((part) => referenceParts.includes(part))) score += 2;
    }
  }

  if (typeof candidate.bedrooms === "number" && typeof reference.bedrooms === "number") {
    const diff = Math.abs(candidate.bedrooms - reference.bedrooms);
    if (diff === 0) score += 2;
    else if (diff === 1) score += 1;
  }

  if (typeof candidate.bathrooms === "number" && typeof reference.bathrooms === "number") {
    if (candidate.bathrooms === reference.bathrooms) score += 1;
  }

  if (typeof candidate.price === "number" && typeof reference.price === "number" && reference.price > 0) {
    const ratio = Math.abs(candidate.price - reference.price) / reference.price;
    if (ratio <= 0.15) score += 2;
    else if (ratio <= 0.3) score += 1;
  }

  if (typeof candidate.area === "number" && typeof reference.area === "number" && reference.area > 0) {
    const ratio = Math.abs(candidate.area - reference.area) / reference.area;
    if (ratio <= 0.2) score += 1;
  }

  if (Array.isArray(candidate.features) && Array.isArray(reference.features)) {
    const referenceFeatures = new Set(reference.features.map((f) => f.toLowerCase()));
    score += candidate.features.filter((f) => referenceFeatures.has(f.toLowerCase())).length;
  }

  return score;
}

function recommendProperties(inquiryState: InquiryState) {
  if (!inquiryState.propertyId) {
    return {
      success: false,
      error: "There is no property selected in the inquiry yet, so there's no basis for a recommendation.",
    };
  }

  const properties = readProperties();
  const referenceProperty = properties.find((p) => p.id === inquiryState.propertyId);
  if (!referenceProperty) {
    return { success: false, error: "The selected property could not be found in the current listings." };
  }

  const declinedPropertyIds = new Set(inquiryState.declinedPropertyIds || []);
  const referenceCategory = propertyCategory(referenceProperty);

  const recommendations = properties
    .filter(
      (property) =>
        property.id !== referenceProperty.id &&
        isAvailable(property) &&
        !declinedPropertyIds.has(property.id) &&
        propertyCategory(property) === referenceCategory,
    )
    .map((property) => ({ property, score: scorePropertySimilarity(property, referenceProperty) }))
    .filter((entry) => entry.score >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((entry) => ({
      id: entry.property.id,
      name: entry.property.name,
      propertyType: entry.property.propertyType,
      location: entry.property.location,
      price: entry.property.price,
      bedrooms: entry.property.bedrooms,
      bathrooms: entry.property.bathrooms,
      area: entry.property.area,
      features: entry.property.features,
      availability: entry.property.availability,
    }));

  if (recommendations.length === 0) {
    return { success: true, recommendations: [], message: "No genuinely relevant alternatives were found." };
  }

  return { success: true, recommendations };
}

function declineRecommendation(input: { propertyId?: string }, inquiryState: InquiryState) {
  const propertyId = input && input.propertyId;
  if (!propertyId || typeof propertyId !== "string") {
    return { success: false, error: "propertyId is required." };
  }

  const property = readProperties().find((p) => p.id === propertyId);
  if (!property) {
    return { success: false, error: `No property found with id "${propertyId}".` };
  }

  if (!Array.isArray(inquiryState.declinedPropertyIds)) {
    inquiryState.declinedPropertyIds = [];
  }
  if (!inquiryState.declinedPropertyIds.includes(propertyId)) {
    inquiryState.declinedPropertyIds.push(propertyId);
  }

  return { success: true, declinedPropertyId: property.id };
}

// Inquiry-related fee configuration. The project currently defines no real
// viewing/application/service fee or tax rate (see prompts/system-prompt.md:
// "There is no discount, fee, commission, or financing data anywhere in the
// project"). Every amount is 0 until an authorized business value replaces
// it here; a property's listed price is never read or used by this.
const FEE_CONFIG = {
  currency: "USD",
  taxRate: 0,
  feesByInquiryType: { viewing: 0, information: 0, contact: 0 } as Record<string, number>,
};

function round2(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function findEligibleFeePromotion(promotionId: string): { promotion: Promotion | null; error: string | null } {
  const promotion = readPromotions().find((p) => p.id.toLowerCase() === promotionId.toLowerCase());
  if (!promotion) {
    return { promotion: null, error: `No promotion found with id "${promotionId}".` };
  }
  if (!promotion.active) {
    return { promotion: null, error: `Promotion "${promotion.name}" is not currently active.` };
  }
  const percent = promotion.feeDiscountPercent;
  if (promotion.appliesToFee !== true || typeof percent !== "number" || !(percent >= 0 && percent <= 100)) {
    return { promotion: null, error: `Promotion "${promotion.name}" does not apply to inquiry fees.` };
  }
  return { promotion, error: null };
}

function resolvePromotionForFee(promotionId: string | null, baseFee: number) {
  if (!promotionId) return { promotionApplied: null as string | null, discount: 0, reason: null as string | null };
  const { promotion, error } = findEligibleFeePromotion(promotionId);
  if (!promotion) return { promotionApplied: null, discount: 0, reason: error };
  return {
    promotionApplied: promotion.id,
    discount: round2(baseFee * ((promotion.feeDiscountPercent as number) / 100)),
    reason: null,
  };
}

function calculateInquiryFee(input: { promotionId?: string }, inquiryState: InquiryState) {
  const baseFee = FEE_CONFIG.feesByInquiryType[inquiryState.inquiryType || ""] || 0;
  const tax = round2(baseFee * FEE_CONFIG.taxRate);

  const explicitPromotionId =
    input && typeof input.promotionId === "string" && input.promotionId.trim() ? input.promotionId.trim() : null;
  const promotionId = explicitPromotionId || inquiryState.promotionId || null;
  const { promotionApplied, discount, reason } = resolvePromotionForFee(promotionId, baseFee);

  const finalFee = Math.max(0, round2(baseFee + tax - discount));

  return {
    success: true,
    baseFee,
    tax,
    discount,
    finalFee,
    currency: FEE_CONFIG.currency,
    hasApplicableFee: baseFee > 0 || tax > 0,
    promotionApplied,
    ...(reason ? { promotionNote: reason } : {}),
  };
}

// ---- Anthropic tool-use loop ------------------------------------------------

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const tools: Anthropic.Tool[] = [
  {
    name: "getProperties",
    description:
      "Get the list of real estate properties that are currently available (for sale or for rent). " +
      "Use this whenever the user asks what properties are available.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "addPropertyToInquiry",
    description:
      "Add a specific, currently-available property to the user's session inquiry state, identified " +
      "by its exact property id (e.g. from getProperties). Only call this once you know which exact " +
      "property the user means. This only records which property the inquiry is about — it does not " +
      "confirm or submit anything. The result includes the current inquiry state so you can see what " +
      "information (inquiry type, customer details, preferred date/time, message) is still missing " +
      "and ask the user for it instead of guessing.",
    input_schema: {
      type: "object",
      properties: { propertyId: { type: "string", description: 'The exact id of the property, e.g. "prop-005".' } },
      required: ["propertyId"],
    },
  },
  {
    name: "updatePropertyInquiry",
    description:
      "Update fields on the user's existing session inquiry (the one started with " +
      "addPropertyToInquiry). Only include fields the user actually specified — never guess. " +
      "Changing propertyId is validated against the property listings the same way as " +
      "addPropertyToInquiry (must exist and be currently available). This does not confirm or " +
      "submit the inquiry, and never changes the confirmed status. Returns the updated inquiry " +
      "state, or a clear error if the update is invalid, so you can ask the user for clarification.",
    input_schema: {
      type: "object",
      properties: {
        propertyId: { type: "string", description: 'New property id to switch the inquiry to, e.g. "prop-005".' },
        inquiryType: { type: "string", description: "One of: viewing, information, contact." },
        preferredDate: { type: "string", description: "Customer-provided preferred date." },
        preferredTime: { type: "string", description: "Customer-provided preferred time." },
        message: {
          type: "string",
          description:
            "Customer-provided message, preferences, or optional viewing instructions (e.g. preferred " +
            "entrance, accessibility needs, gate/building access notes). Never invent.",
        },
        promotionId: {
          type: "string",
          description:
            'The exact promotion id/code the customer explicitly wants applied to this inquiry, e.g. "promo-002". ' +
            "Only include if the customer explicitly named a promotion — never guess or invent one. Validated " +
            "against data/promotions.json; rejected with a clear error if the promotion is unknown, inactive, " +
            "or not eligible for inquiry fees, so you can relay that to the customer instead of applying it.",
        },
        customerDetails: {
          type: "object",
          description:
            "Any of the customer's own contact/location details the user provided. Never guess or invent any " +
            "of these. address and unit are for the CUSTOMER's own address/unit, not the property's — only " +
            "include them if the customer actually provided one and it's genuinely relevant to the inquiry " +
            "(e.g. needed for correspondence); do not ask for them otherwise. The property's own " +
            "address/location always comes from the verified property data, never from the customer.",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string", description: "The customer's phone number, exactly as provided." },
            address: { type: "string", description: "The customer's own address, only if genuinely required and provided by the customer." },
            unit: { type: "string", description: "The customer's own apartment/unit number, only if applicable and provided by the customer." },
          },
        },
      },
    },
  },
  {
    name: "removePropertyFromInquiry",
    description:
      "Remove a specific property from the user's session inquiry, identified by its exact property " +
      "id. Use this only when the user explicitly asks to remove or drop a property from their " +
      "inquiry. This does not confirm or submit anything. Returns a clear error if the property id " +
      "doesn't exist, or if it isn't currently part of the inquiry.",
    input_schema: {
      type: "object",
      properties: { propertyId: { type: "string", description: 'The exact id of the property to remove, e.g. "prop-005".' } },
      required: ["propertyId"],
    },
  },
  {
    name: "viewInquiry",
    description:
      "Get a read-only snapshot of the user's current session inquiry state — selected property, " +
      "inquiry type, preferred date/time, customer details provided so far, message, status, " +
      "confirmation status, and the saved inquiryId if this inquiry has already been confirmed and " +
      "persisted (null otherwise). Use this when the user asks to see, review, or confirm what's " +
      "currently in their inquiry, or asks for their inquiry id again. Does not modify anything and " +
      "never includes prices, totals, or discounts.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "getInquiryRequirements",
    description:
      "Check what's still needed before the user's current viewing request/inquiry could be " +
      "submitted: a selected property, the inquiry type (viewing, information, or contact), the " +
      "customer's name, and the customer's phone number are required; preferred viewing date/time, " +
      "the customer's own address/unit, any viewing instructions, and an applied promotion are " +
      "optional and never block readiness. Use this before asking the user for any inquiry details, " +
      "so you only ask for fields listed in the response's missingRequired array and never re-ask for " +
      "information that's already set (this includes the property's own address, which comes from the " +
      "verified property data, not the customer). Read-only — does not modify or submit anything, and " +
      "readyToSubmit being true does NOT mean the inquiry is confirmed or submitted; explicit user " +
      "confirmation is still required before that.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "getInquiryConfirmationSummary",
    description:
      "Get the complete, final confirmation summary for the current inquiry/viewing request: full " +
      "verified property details (id, name, location, type, bedrooms, bathrooms, area, listing price " +
      "— from data/properties.json), inquiry type, preferred date/time, customer name/phone/unit, any " +
      "viewing instructions, the currently applied promotion (only if still active and eligible), and " +
      "the deterministic fee/tax/discount breakdown — using only what's actually stored in the session " +
      "plus backend-verified data. Call this before asking for final confirmation, and again after any " +
      "correction (it automatically recalculates fees/promotion). Read this tool's own `notes` field " +
      "for exactly how to present the summary and what counts as explicit confirmation. This call must " +
      "immediately precede asking for confirmation — calling it internally arms the backend's " +
      "confirmation gate for confirmInquiry, and any further change to the inquiry disarms it again, " +
      "so confirmInquiry cannot succeed on a stale confirmation from earlier in the conversation. Never " +
      "modifies the inquiry's own content or submits anything by itself.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "confirmInquiry",
    description:
      "Finalize AND permanently save the current inquiry/viewing request to data/inquiries.json. Only " +
      "call this after you have shown the full confirmation summary (from getInquiryConfirmationSummary) " +
      "and the customer has given a clear, explicit confirmation such as 'yes', 'confirm', or 'that's " +
      "correct' — never for vague replies like 'okay' or 'sounds good', and never based on silence or " +
      "the absence of a correction. If the customer indicates anything is wrong, do not call this — use " +
      "updatePropertyInquiry or removePropertyFromInquiry instead, then re-show the summary and get " +
      "explicit confirmation again. Fails with a clear error (and saves nothing) if required information " +
      "is still missing, the selected property is no longer available, getInquiryConfirmationSummary has " +
      "not been called for the inquiry since its last change, or the save itself fails — never claim the " +
      "inquiry was submitted unless this tool returns success. On success, returns a backend-generated " +
      "inquiryId, timestamp, and status \"NEW\" — always relay the exact inquiryId returned, never invent " +
      "or reformat one. Calling this again with nothing changed since the last successful confirmation " +
      "does not create a duplicate record — it returns the same inquiryId with alreadySubmitted: true.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "recommendProperties",
    description:
      "Suggest up to 2 currently-available properties from the listings that are genuinely relevant " +
      "to the user's current inquiry, based on similarity to the selected property (type, location, " +
      "price, bedrooms/bathrooms, size, and features). Use this when the user asks for suggestions or " +
      "alternatives, or when offering a relevant alternative is natural. Never call this to modify the " +
      "inquiry — recommendations are suggestions only; only use addPropertyToInquiry/updatePropertyInquiry " +
      "if the user explicitly asks to switch to a recommended property. Automatically excludes the " +
      "currently selected property and any property the user has already declined this session. May " +
      "return zero recommendations if nothing is genuinely relevant — do not force one.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "calculateInquiryFee",
    description:
      "Deterministically calculate any fee, tax, and discount that applies to the current inquiry, " +
      "using only backend configuration and data/promotions.json — never estimate, invent, or perform " +
      "this arithmetic yourself. A property's listed price is informational only and is never read or " +
      "treated as a payable total by this tool. Currently every inquiry type has a configured fee of 0 " +
      "unless the project defines a real one. If promotionId is omitted, this automatically uses " +
      "whatever promotion is already applied to the inquiry (set via updatePropertyInquiry) if any. " +
      "Only pass promotionId explicitly if the customer names a different specific promotion right now; " +
      "never guess or invent one. Report exactly the baseFee, tax, discount, and finalFee values this " +
      "tool returns — do not adjust, round, or recompute them yourself. An unknown, inactive, or " +
      "ineligible promotion always returns discount 0 with a promotionNote explaining why — relay that " +
      "note to the customer rather than claiming a discount was applied.",
    input_schema: {
      type: "object",
      properties: {
        promotionId: {
          type: "string",
          description: 'The exact promotion id/code the customer explicitly mentioned, e.g. "promo-002". Omit if the customer didn\'t mention one.',
        },
      },
    },
  },
  {
    name: "declineRecommendation",
    description:
      "Record that the user explicitly declined a property that was previously recommended (e.g. " +
      "\"no, I'm not interested\" or \"skip that one\"), identified by its exact property id. This only " +
      "prevents that property from being suggested again this session via recommendProperties — it " +
      "does not modify the inquiry itself.",
    input_schema: {
      type: "object",
      properties: { propertyId: { type: "string", description: 'The exact id of the declined property, e.g. "prop-005".' } },
      required: ["propertyId"],
    },
  },
];

async function runToolCall(toolUseBlock: Anthropic.ToolUseBlock, inquiryState: InquiryState) {
  const input = toolUseBlock.input as Record<string, unknown>;
  switch (toolUseBlock.name) {
    case "getProperties":
      return getAvailableProperties();
    case "addPropertyToInquiry":
      return addPropertyToInquiry(input, inquiryState);
    case "updatePropertyInquiry":
      return updatePropertyInquiry(input, inquiryState);
    case "removePropertyFromInquiry":
      return removePropertyFromInquiry(input, inquiryState);
    case "viewInquiry":
      return viewInquiry(inquiryState);
    case "getInquiryRequirements":
      return getInquiryRequirements(inquiryState);
    case "getInquiryConfirmationSummary":
      return getInquiryConfirmationSummary(inquiryState);
    case "confirmInquiry":
      return confirmInquiry(inquiryState);
    case "recommendProperties":
      return recommendProperties(inquiryState);
    case "declineRecommendation":
      return declineRecommendation(input, inquiryState);
    case "calculateInquiryFee":
      return calculateInquiryFee(input, inquiryState);
    default:
      return { error: `Unknown tool: ${toolUseBlock.name}` };
  }
}

interface ChatRequestBody {
  message?: unknown;
  conversationHistory?: Anthropic.MessageParam[];
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[chat] ANTHROPIC_API_KEY is not configured");
    return NextResponse.json({ error: "The assistant is not configured yet." }, { status: 503 });
  }

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { message, conversationHistory } = body;
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const cookieMatch = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`));
  const inquiryState = decodeInquiryState(cookieMatch ? decodeURIComponent(cookieMatch[1]) : undefined);

  try {
    const systemPrompt = readSystemPrompt();
    const properties = readProperties();
    const propertiesContext =
      "## Available Property Listings (authoritative data)\n\n" +
      "This is the complete list of properties currently available. Answer property questions using " +
      "only this data. If something isn't covered here, say you don't have that information.\n\n" +
      JSON.stringify(properties);
    const fullSystemPrompt = systemPrompt + "\n\n" + propertiesContext;

    const messages: Anthropic.MessageParam[] = [...(conversationHistory || []), { role: "user", content: message }];

    let response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: fullSystemPrompt,
      messages,
      tools,
    });

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        const result = await runToolCall(block, inquiryState);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      }
      messages.push({ role: "user", content: toolResults });

      response = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: fullSystemPrompt,
        messages,
        tools,
      });
    }

    const reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    const res = NextResponse.json({ reply: reply || "Sorry, I don't have an answer for that right now." });
    res.cookies.set(SESSION_COOKIE, encodeInquiryState(inquiryState), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return res;
  } catch (error) {
    console.error("[chat] error:", error);
    return NextResponse.json({ error: "Failed to get a response from the assistant" }, { status: 502 });
  }
}
