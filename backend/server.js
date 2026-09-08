const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const crypto = require("crypto");
const fs = require("fs");
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use(express.json());

// In-memory, session-based inquiry state for local development only.
// Not persisted anywhere; lost on server restart. Replace with a real
// store before production.
const INQUIRY_SESSION_COOKIE = "inquirySessionId";
const inquirySessions = new Map();

function createEmptyInquiryState() {
  return {
    propertyId: null,
    propertyName: null,
    inquiryType: null,
    customerDetails: {
      name: null,
      email: null,
      phone: null,
      address: null,
      unit: null,
    },
    preferredDate: null,
    preferredTime: null,
    message: null,
    discount: null,
    total: null,
    promotionId: null,
    confirmed: false,
    summaryAcknowledged: false,
    savedInquiryId: null,
    status: "draft",
    declinedPropertyIds: [],
  };
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) {
    return cookies;
  }
  cookieHeader.split(";").forEach((pair) => {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }
    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function inquirySessionMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  let sessionId = cookies[INQUIRY_SESSION_COOKIE];

  if (!sessionId || !inquirySessions.has(sessionId)) {
    sessionId = crypto.randomUUID();
    inquirySessions.set(sessionId, createEmptyInquiryState());
    res.cookie(INQUIRY_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
    });
  }

  req.inquirySessionId = sessionId;
  req.inquiryState = inquirySessions.get(sessionId);
  next();
}

app.use(inquirySessionMiddleware);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const systemPrompt = fs.readFileSync(
  path.join(__dirname, "..", "prompts", "system-prompt.md"),
  "utf8"
);

const properties = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "properties.json"), "utf8")
).properties;

const propertiesContext =
  "## Available Property Listings (authoritative data)\n\n" +
  "This is the complete list of properties currently available. Answer property " +
  "questions using only this data. If something isn't covered here, say you don't " +
  "have that information.\n\n" +
  JSON.stringify(properties);

const fullSystemPrompt = systemPrompt + "\n\n" + propertiesContext;

const UNAVAILABLE_STATUSES = new Set(["sold", "rented", "unavailable", "off market"]);

function readProperties() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", "properties.json"), "utf8")
  ).properties;
}

function isAvailable(property) {
  const availability = (property.availability || "").toLowerCase();
  return Boolean(availability) && !UNAVAILABLE_STATUSES.has(availability);
}

function getAvailableProperties() {
  return readProperties().filter(isAvailable);
}

const INQUIRIES_FILE_PATH = path.join(__dirname, "..", "data", "inquiries.json");

function readInquiriesFile() {
  const raw = fs.readFileSync(INQUIRIES_FILE_PATH, "utf8");
  const parsed = raw.trim() ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? parsed : [];
}

function appendInquiryRecord(record) {
  const inquiries = readInquiriesFile();
  inquiries.push(record);
  fs.writeFileSync(INQUIRIES_FILE_PATH, JSON.stringify(inquiries, null, 2) + "\n", "utf8");
}

function addPropertyToInquiry(input, inquiryState) {
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

function isPlausiblePhoneNumber(phone) {
  const digitCount = (phone.match(/\d/g) || []).length;
  return digitCount >= MIN_PHONE_DIGITS;
}

function updatePropertyInquiry(input, inquiryState) {
  if (!input || typeof input !== "object") {
    return { success: false, error: "No update fields were provided." };
  }

  if (!inquiryState.propertyId && !input.propertyId) {
    return {
      success: false,
      error: "There is no inquiry in progress yet. Use addPropertyToInquiry to start one first.",
    };
  }

  const updates = {};

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

  let customerDetailsUpdates = null;
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
    for (const field of ["name", "email", "phone", "address", "unit"]) {
      if (input.customerDetails[field] !== undefined) {
        if (typeof input.customerDetails[field] !== "string" || !input.customerDetails[field].trim()) {
          return { success: false, error: `customerDetails.${field} must be a non-empty string.` };
        }
        const value = input.customerDetails[field].trim();
        if (field === "phone" && !isPlausiblePhoneNumber(value)) {
          return {
            success: false,
            error: "That phone number doesn't look valid. Please provide it again.",
          };
        }
        customerDetailsUpdates[field] = value;
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

  // Any successful update invalidates whatever summary was last shown, so the
  // confirmation gate (see confirmInquiry) requires a fresh
  // getInquiryConfirmationSummary call — and a new explicit confirmation —
  // before this inquiry can be confirmed again. It also invalidates any
  // prior saved record: a later confirmation must persist a fresh inquiry
  // record reflecting the correction, not silently reuse the old one.
  inquiryState.summaryAcknowledged = false;
  inquiryState.savedInquiryId = null;
  if (inquiryState.confirmed) {
    inquiryState.confirmed = false;
    inquiryState.status = "draft";
  }

  return { success: true, inquiryState };
}

function removePropertyFromInquiry(input, inquiryState) {
  const propertyId = input && input.propertyId;
  if (!propertyId || typeof propertyId !== "string") {
    return { success: false, error: "propertyId is required." };
  }

  const property = readProperties().find((p) => p.id === propertyId);
  if (!property) {
    return { success: false, error: `No property found with id "${propertyId}".` };
  }

  if (inquiryState.propertyId !== propertyId) {
    return {
      success: false,
      error: `"${property.name}" is not currently part of this inquiry.`,
    };
  }

  inquiryState.propertyId = null;
  inquiryState.propertyName = null;
  inquiryState.status = "draft";
  inquiryState.confirmed = false;
  inquiryState.summaryAcknowledged = false;
  inquiryState.savedInquiryId = null;

  return { success: true, removedPropertyId: property.id, inquiryState };
}

function getInquiryRequirements(inquiryState) {
  const customerName = (inquiryState.customerDetails && inquiryState.customerDetails.name) || null;
  const customerPhone = (inquiryState.customerDetails && inquiryState.customerDetails.phone) || null;

  const missingRequired = [];
  if (!inquiryState.propertyId) {
    missingRequired.push("propertyId");
  }
  if (!inquiryState.inquiryType) {
    missingRequired.push("inquiryType");
  }
  if (!customerName) {
    missingRequired.push("customerName");
  }
  if (!customerPhone) {
    missingRequired.push("customerPhone");
  }

  return {
    propertyId: inquiryState.propertyId,
    propertyName: inquiryState.propertyName,
    inquiryType: inquiryState.inquiryType,
    preferredDate: inquiryState.preferredDate,
    preferredTime: inquiryState.preferredTime,
    customerName,
    customerPhone,
    customerAddress: (inquiryState.customerDetails && inquiryState.customerDetails.address) || null,
    customerUnit: (inquiryState.customerDetails && inquiryState.customerDetails.unit) || null,
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

function viewInquiry(inquiryState) {
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

function getInquiryConfirmationSummary(inquiryState) {
  const requirements = getInquiryRequirements(inquiryState);

  let property = null;
  if (inquiryState.propertyId) {
    property = readProperties().find((p) => p.id === inquiryState.propertyId) || null;
  }

  let promotion = null;
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
    // If it's no longer valid, promotion stays null here — the fee
    // calculation's own promotionNote (below) explains why, rather than
    // this tool inventing a promotion summary for something not applied.
  }

  const fee = calculateInquiryFee({}, inquiryState);

  // Arms the confirmation gate enforced by confirmInquiry: only a genuinely
  // complete summary (readyToSubmit) counts as "the customer has had the
  // chance to review it". Any subsequent change to the inquiry (see
  // addPropertyToInquiry/updatePropertyInquiry/removePropertyFromInquiry)
  // disarms it again, so a stale "yes" from earlier in the conversation can
  // never confirm a summary that was never actually shown for the current
  // state. This never changes any inquiry content — only this bookkeeping.
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
      "not mention any promotion even if the customer previously named one (updatePropertyInquiry would " +
      "already have told them if it was rejected as unknown, inactive, or ineligible). fees are the " +
      "exact deterministic values returned by the backend calculation — never recompute, round, or " +
      "adjust them yourself; if hasApplicableFee is false, tell the customer there is no inquiry fee " +
      "rather than presenting 0 as if it were a real total. After showing this summary, you must get a " +
      "clear, explicit confirmation (e.g. 'yes', 'confirm', 'that's correct') before calling " +
      "confirmInquiry — vague replies like 'okay' or 'sounds good' are not sufficient, and silence is " +
      "never confirmation. If the customer asks to change something, call updatePropertyInquiry or " +
      "removePropertyFromInquiry for only that change, then call this tool again (which recalculates " +
      "fees/promotion automatically) and get explicit re-confirmation before proceeding.",
  };
}

function confirmInquiry(inquiryState) {
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
  // *current* form. Any modification since then clears this flag (see
  // addPropertyToInquiry/updatePropertyInquiry/removePropertyFromInquiry),
  // so an earlier "yes" — or any confirmation attempt not preceded by the
  // current summary — is rejected regardless of what the model believes
  // the customer meant. This is intentionally independent of the model's
  // own judgment about the conversation.
  if (!inquiryState.summaryAcknowledged) {
    return {
      success: false,
      error:
        "The complete confirmation summary hasn't been shown for the inquiry in its current form yet. " +
        "Call getInquiryConfirmationSummary, show it to the customer, and get their explicit " +
        "confirmation before calling this again.",
    };
  }

  // Idempotency: if this exact inquiry was already confirmed and persisted,
  // and nothing has changed since (any change would already have cleared
  // confirmed/savedInquiryId above), don't write a second record for what
  // is really the same confirmation/submission event.
  if (inquiryState.confirmed && inquiryState.savedInquiryId) {
    return {
      success: true,
      alreadySubmitted: true,
      inquiryId: inquiryState.savedInquiryId,
      inquiryState,
    };
  }

  const fee = calculateInquiryFee({}, inquiryState);
  const appliedPromotion = inquiryState.promotionId
    ? findEligibleFeePromotion(inquiryState.promotionId).promotion
    : null;

  // The model never supplies these — both are generated here, by backend
  // code, only at the moment a fully-gated confirmation is actually saved.
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
    fee: {
      baseFee: fee.baseFee,
      tax: fee.tax,
      discount: fee.discount,
      finalFee: fee.finalFee,
      currency: fee.currency,
    },
    confirmed: true,
  };

  try {
    appendInquiryRecord(record);
  } catch (err) {
    console.error("Failed to persist confirmed inquiry:", err);
    return {
      success: false,
      error: "The inquiry could not be saved right now. Please try confirming again.",
    };
  }

  inquiryState.confirmed = true;
  inquiryState.status = "confirmed";
  inquiryState.savedInquiryId = inquiryId;

  return { success: true, inquiryId, timestamp, status: "NEW", inquiryState };
}

const RESIDENTIAL_PROPERTY_TYPES = new Set(["apartment", "house", "villa", "townhouse", "condo"]);

function propertyCategory(property) {
  const type = (property.propertyType || "").toLowerCase();
  return RESIDENTIAL_PROPERTY_TYPES.has(type) ? "residential" : "commercial";
}

const MIN_RELEVANCE_SCORE = 3;

function scorePropertySimilarity(candidate, reference) {
  let score = 0;

  if (candidate.propertyType && candidate.propertyType === reference.propertyType) {
    score += 3;
  }

  if (candidate.availability && candidate.availability === reference.availability) {
    score += 2;
  }

  if (candidate.location && reference.location) {
    const candidateLocation = candidate.location.toLowerCase();
    const referenceLocation = reference.location.toLowerCase();
    if (candidateLocation === referenceLocation) {
      score += 3;
    } else {
      const candidateParts = candidateLocation.split(",").map((part) => part.trim());
      const referenceParts = referenceLocation.split(",").map((part) => part.trim());
      if (candidateParts.some((part) => referenceParts.includes(part))) {
        score += 2;
      }
    }
  }

  if (typeof candidate.bedrooms === "number" && typeof reference.bedrooms === "number") {
    const diff = Math.abs(candidate.bedrooms - reference.bedrooms);
    if (diff === 0) score += 2;
    else if (diff === 1) score += 1;
  }

  if (typeof candidate.bathrooms === "number" && typeof reference.bathrooms === "number") {
    if (candidate.bathrooms === reference.bathrooms) {
      score += 1;
    }
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
    const referenceFeatures = new Set(reference.features.map((feature) => feature.toLowerCase()));
    const overlap = candidate.features.filter((feature) =>
      referenceFeatures.has(feature.toLowerCase())
    ).length;
    score += overlap;
  }

  return score;
}

function recommendProperties(inquiryState) {
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
        propertyCategory(property) === referenceCategory
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

function declineRecommendation(input, inquiryState) {
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
// viewing/application/service fee or tax rate — see prompts/system-prompt.md
// ("There is no discount, fee, commission, or financing data anywhere in the
// project"). Every amount is 0 until an authorized business value replaces
// it here; the calculation logic stays deterministic either way, and a
// property's listed price is never read or used by any of it.
const FEE_CONFIG = {
  currency: "USD",
  taxRate: 0, // decimal fraction, e.g. 0.05 for 5%. 0 = not applicable.
  feesByInquiryType: {
    viewing: 0,
    information: 0,
    contact: 0,
  },
};

function readPromotions() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", "promotions.json"), "utf8")
  ).promotions;
}

function round2(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

// A promotion can only discount a calculated inquiry fee if it is active AND
// explicitly declares itself machine-applicable to fees via `appliesToFee:
// true` plus a numeric `feeDiscountPercent` (0-100). The real promotions in
// data/promotions.json describe commission/rent/sale-price adjustments in
// free text — not inquiry fees — and none carry those fields, so none of
// them can discount a fee today. That is correct behavior, not a bug: this
// never infers a numeric discount from prose, and never trusts a discount
// value the model might supply directly. Shared by updatePropertyInquiry
// (validates before storing a promotion on the inquiry) and the fee
// calculation below (re-validates at calculation time, since a stored
// promotion could have since gone inactive).
function findEligibleFeePromotion(promotionId) {
  const promotion = readPromotions().find(
    (p) => p.id.toLowerCase() === promotionId.toLowerCase()
  );
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

function resolvePromotionForFee(promotionId, baseFee) {
  if (!promotionId) {
    return { promotionApplied: null, discount: 0, reason: null };
  }
  const { promotion, error } = findEligibleFeePromotion(promotionId);
  if (!promotion) {
    return { promotionApplied: null, discount: 0, reason: error };
  }
  return {
    promotionApplied: promotion.id,
    discount: round2(baseFee * (promotion.feeDiscountPercent / 100)),
    reason: null,
  };
}

function calculateInquiryFee(input, inquiryState) {
  const baseFee = FEE_CONFIG.feesByInquiryType[inquiryState.inquiryType] || 0;
  const tax = round2(baseFee * FEE_CONFIG.taxRate);

  const explicitPromotionId =
    input && typeof input.promotionId === "string" && input.promotionId.trim()
      ? input.promotionId.trim()
      : null;
  // Falls back to whatever promotion is already stored on the inquiry (set
  // via updatePropertyInquiry) so this always reflects the inquiry's
  // currently applied promotion unless a different one is explicitly given.
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

const tools = [
  {
    name: "getProperties",
    description:
      "Get the list of real estate properties that are currently available (for sale or for rent). " +
      "Use this whenever the user asks what properties are available.",
    input_schema: {
      type: "object",
      properties: {},
    },
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
      properties: {
        propertyId: {
          type: "string",
          description: "The exact id of the property, e.g. \"prop-005\".",
        },
      },
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
        propertyId: {
          type: "string",
          description: "New property id to switch the inquiry to, e.g. \"prop-005\".",
        },
        inquiryType: {
          type: "string",
          description: "One of: viewing, information, contact.",
        },
        preferredDate: { type: "string", description: "Customer-provided preferred date." },
        preferredTime: { type: "string", description: "Customer-provided preferred time." },
        message: {
          type: "string",
          description: "Customer-provided message, preferences, or optional viewing instructions " +
            "(e.g. preferred entrance, accessibility needs, gate/building access notes). Never invent.",
        },
        promotionId: {
          type: "string",
          description:
            "The exact promotion id/code the customer explicitly wants applied to this inquiry, e.g. " +
            "\"promo-002\". Only include if the customer explicitly named a promotion — never guess or " +
            "invent one. Validated against data/promotions.json; rejected with a clear error if the " +
            "promotion is unknown, inactive, or not eligible for inquiry fees, so you can relay that " +
            "to the customer instead of applying it.",
        },
        customerDetails: {
          type: "object",
          description:
            "Any of the customer's own contact/location details the user provided. Never guess or " +
            "invent any of these. address and unit are for the CUSTOMER's own address/unit, not the " +
            "property's — only include them if the customer actually provided one and it's genuinely " +
            "relevant to the inquiry (e.g. needed for correspondence); do not ask for them otherwise. " +
            "The property's own address/location always comes from the verified property data, never " +
            "from the customer.",
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
      "Remove a specific property from the user's session inquiry, identified by its exact " +
      "property id. Use this only when the user explicitly asks to remove or drop a property " +
      "from their inquiry. This does not confirm or submit anything. Returns a clear error if " +
      "the property id doesn't exist, or if it isn't currently part of the inquiry.",
    input_schema: {
      type: "object",
      properties: {
        propertyId: {
          type: "string",
          description: "The exact id of the property to remove, e.g. \"prop-005\".",
        },
      },
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
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "getInquiryRequirements",
    description:
      "Check what's still needed before the user's current viewing request/inquiry could be " +
      "submitted: a selected property, the inquiry type (viewing, information, or contact), the " +
      "customer's name, and the customer's phone number are required; preferred viewing date/time, " +
      "the customer's own address/unit, any viewing instructions, and an applied promotion are " +
      "optional and never block readiness. Use this before asking the user for any " +
      "inquiry details, so you only ask for fields listed in the response's missingRequired array and " +
      "never re-ask for information that's already set (this includes the property's own address, " +
      "which comes from the verified property data, not the customer). Read-only — does not modify or " +
      "submit anything, and readyToSubmit being true does NOT mean the inquiry is confirmed or " +
      "submitted; explicit user confirmation is still required before that.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "getInquiryConfirmationSummary",
    description:
      "Get the complete, final confirmation summary for the current inquiry/viewing request: full " +
      "verified property details (id, name, location, type, bedrooms, bathrooms, area, listing price — " +
      "from data/properties.json), inquiry type, preferred date/time, customer name/phone/unit, any " +
      "viewing instructions, the currently applied promotion (only if still active and eligible), and " +
      "the deterministic fee/tax/discount breakdown — using only what's actually stored in the session " +
      "plus backend-verified data. Call this before asking for final confirmation, and again after any " +
      "correction (it automatically recalculates fees/promotion). Read this tool's own `notes` field " +
      "for exactly how to present the summary and what counts as explicit confirmation. This call must " +
      "immediately precede asking for confirmation — calling it internally arms the backend's " +
      "confirmation gate for confirmInquiry, and any further change to the inquiry disarms it again, " +
      "so confirmInquiry cannot succeed on a stale confirmation from earlier in the conversation. Never " +
      "modifies the inquiry's own content or submits anything by itself.",
    input_schema: {
      type: "object",
      properties: {},
    },
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
    input_schema: {
      type: "object",
      properties: {},
    },
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
      "currently selected property and any property the user has already declined this session. " +
      "May return zero recommendations if nothing is genuinely relevant — do not force one.",
    input_schema: {
      type: "object",
      properties: {},
    },
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
      "never guess or invent one. Report exactly the baseFee, tax, discount, and " +
      "finalFee values this tool returns — do not adjust, round, or recompute them yourself. An unknown, " +
      "inactive, or ineligible promotion always returns discount 0 with a promotionNote explaining why — " +
      "relay that note to the customer rather than claiming a discount was applied.",
    input_schema: {
      type: "object",
      properties: {
        promotionId: {
          type: "string",
          description:
            "The exact promotion id/code the customer explicitly mentioned, e.g. \"promo-002\". Omit " +
            "if the customer didn't mention one.",
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
      properties: {
        propertyId: {
          type: "string",
          description: "The exact id of the declined property, e.g. \"prop-005\".",
        },
      },
      required: ["propertyId"],
    },
  },
];

async function runToolCall(toolUseBlock, inquiryState) {
  if (toolUseBlock.name === "getProperties") {
    return getAvailableProperties();
  }
  if (toolUseBlock.name === "addPropertyToInquiry") {
    return addPropertyToInquiry(toolUseBlock.input, inquiryState);
  }
  if (toolUseBlock.name === "updatePropertyInquiry") {
    return updatePropertyInquiry(toolUseBlock.input, inquiryState);
  }
  if (toolUseBlock.name === "removePropertyFromInquiry") {
    return removePropertyFromInquiry(toolUseBlock.input, inquiryState);
  }
  if (toolUseBlock.name === "viewInquiry") {
    return viewInquiry(inquiryState);
  }
  if (toolUseBlock.name === "getInquiryRequirements") {
    return getInquiryRequirements(inquiryState);
  }
  if (toolUseBlock.name === "getInquiryConfirmationSummary") {
    return getInquiryConfirmationSummary(inquiryState);
  }
  if (toolUseBlock.name === "confirmInquiry") {
    return confirmInquiry(inquiryState);
  }
  if (toolUseBlock.name === "recommendProperties") {
    return recommendProperties(inquiryState);
  }
  if (toolUseBlock.name === "declineRecommendation") {
    return declineRecommendation(toolUseBlock.input, inquiryState);
  }
  if (toolUseBlock.name === "calculateInquiryFee") {
    return calculateInquiryFee(toolUseBlock.input, inquiryState);
  }
  return { error: `Unknown tool: ${toolUseBlock.name}` };
}

// Staff dashboard: minimal read/update endpoints over data/inquiries.json.
// Only confirmed inquiries are ever in that file (see confirmInquiry) —
// these endpoints only read it and change the `status` field, never any
// other inquiry data.
const INQUIRY_STATUSES = new Set(["NEW", "CONTACTED", "VIEWING_SCHEDULED", "COMPLETED", "CANCELLED"]);

// Forward-only workflow: NEW -> CONTACTED -> VIEWING_SCHEDULED -> COMPLETED,
// with CANCELLED reachable from any non-terminal state. COMPLETED and
// CANCELLED are terminal — no further transitions are allowed from either.
const INQUIRY_STATUS_TRANSITIONS = {
  NEW: new Set(["CONTACTED", "CANCELLED"]),
  CONTACTED: new Set(["VIEWING_SCHEDULED", "CANCELLED"]),
  VIEWING_SCHEDULED: new Set(["COMPLETED", "CANCELLED"]),
  COMPLETED: new Set(),
  CANCELLED: new Set(),
};

app.get("/api/inquiries", (req, res) => {
  try {
    const inquiries = readInquiriesFile();
    const properties = readProperties();
    // Only ever adds a verified propertyName lookup for display — never
    // changes or invents any field actually stored in data/inquiries.json.
    const enriched = inquiries.map((inquiry) => {
      const property = properties.find((p) => p.id === inquiry.propertyId);
      return { ...inquiry, propertyName: property ? property.name : null };
    });
    res.json({ inquiries: enriched });
  } catch (error) {
    console.error("Failed to load inquiries:", error);
    res.status(500).json({ error: "Failed to load inquiries." });
  }
});

app.patch("/api/inquiries/:inquiryId/status", (req, res) => {
  const { inquiryId } = req.params;
  const { status } = req.body || {};

  if (!status || typeof status !== "string" || !INQUIRY_STATUSES.has(status)) {
    return res.status(400).json({
      error: `status must be one of: ${[...INQUIRY_STATUSES].join(", ")}.`,
    });
  }

  let inquiries;
  try {
    inquiries = readInquiriesFile();
  } catch (error) {
    console.error("Failed to load inquiries:", error);
    return res.status(500).json({ error: "Failed to load inquiries." });
  }

  const index = inquiries.findIndex((inquiry) => inquiry.inquiryId === inquiryId);
  if (index === -1) {
    return res.status(404).json({ error: `No inquiry found with id "${inquiryId}".` });
  }

  const current = inquiries[index];
  const allowedNextStatuses = INQUIRY_STATUS_TRANSITIONS[current.status] || new Set();
  if (!allowedNextStatuses.has(status)) {
    return res.status(400).json({
      error: `Cannot change status from "${current.status}" to "${status}".`,
    });
  }

  const updated = { ...current, status };
  inquiries[index] = updated;

  try {
    fs.writeFileSync(INQUIRIES_FILE_PATH, JSON.stringify(inquiries, null, 2) + "\n", "utf8");
  } catch (error) {
    console.error("Failed to save status change:", error);
    return res.status(500).json({ error: "Failed to save the status change." });
  }

  res.json({ inquiry: updated });
});

app.post("/api/chat", async (req, res) => {
  const { message, conversationHistory } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const messages = [...(conversationHistory || []), { role: "user", content: message }];

    let response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: fullSystemPrompt,
      messages,
      tools,
    });

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((block) => block.type === "tool_use");
      messages.push({ role: "assistant", content: response.content });

      const toolResults = [];
      for (const block of toolUseBlocks) {
        const result = await runToolCall(block, req.inquiryState);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
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
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    res.json({
      reply: reply || "Sorry, I don't have an answer for that right now.",
      conversationHistory: conversationHistory || [],
    });
  } catch (error) {
    console.error("Chat API error:", error);
    res.status(502).json({ error: "Failed to get a response from the assistant" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
