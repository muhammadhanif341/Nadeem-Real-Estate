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
    confirmed: false,
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

  return { success: true, removedPropertyId: property.id, inquiryState };
}

function getInquiryRequirements(inquiryState) {
  const customerName = (inquiryState.customerDetails && inquiryState.customerDetails.name) || null;
  const customerPhone = (inquiryState.customerDetails && inquiryState.customerDetails.phone) || null;

  const missingRequired = [];
  if (!inquiryState.propertyId) {
    missingRequired.push("propertyId");
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
    preferredDate: inquiryState.preferredDate,
    preferredTime: inquiryState.preferredTime,
    customerName,
    customerPhone,
    customerAddress: (inquiryState.customerDetails && inquiryState.customerDetails.address) || null,
    customerUnit: (inquiryState.customerDetails && inquiryState.customerDetails.unit) || null,
    message: inquiryState.message,
    missingRequired,
    readyToSubmit: missingRequired.length === 0,
    notes:
      "preferredTime, customerAddress, customerUnit, and message/viewing instructions are optional " +
      "and never block readiness — only ask for them if genuinely relevant, and never invent them. " +
      "Only ask the user for fields listed in missingRequired — never ask again for anything already " +
      "set here (including the property's own address/location, which always comes from the verified " +
      "property data, never from the customer).",
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
  };
}

function getInquiryConfirmationSummary(inquiryState) {
  const requirements = getInquiryRequirements(inquiryState);

  let propertyLocation = null;
  if (inquiryState.propertyId) {
    const property = readProperties().find((p) => p.id === inquiryState.propertyId);
    propertyLocation = property ? property.location : null;
  }

  return {
    readyForConfirmation: requirements.readyToSubmit,
    missingRequired: requirements.missingRequired,
    confirmed: inquiryState.confirmed,
    summary: {
      propertyName: inquiryState.propertyName,
      propertyLocation,
      inquiryType: inquiryState.inquiryType,
      preferredDate: inquiryState.preferredDate,
      preferredTime: inquiryState.preferredTime,
      customerName: requirements.customerName,
      customerPhone: requirements.customerPhone,
      customerUnit: requirements.customerUnit,
      instructions: inquiryState.message,
    },
    notes:
      "Only present this summary once readyForConfirmation is true; if missingRequired is non-empty, " +
      "ask only for those fields first, then call this again. Show only the non-null fields in " +
      "summary — never invent a value for a null one. propertyLocation is the verified property " +
      "address/location from data/properties.json; if it is null, say the exact location isn't " +
      "available rather than guessing one, and never ask the customer to supply the property's own " +
      "address. After showing this summary, you must get a clear, explicit confirmation (e.g. 'yes', " +
      "'confirm', 'that's correct') before calling confirmInquiry — vague replies like 'okay' or " +
      "'sounds good' are not sufficient, and silence is never confirmation. If the customer asks to " +
      "change something, call updatePropertyInquiry or removePropertyFromInquiry for only that change, " +
      "then call this tool again and get explicit re-confirmation before proceeding.",
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

  inquiryState.confirmed = true;
  inquiryState.status = "confirmed";

  return { success: true, inquiryState };
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
// value the model might supply directly.
function resolvePromotionForFee(promotionId, baseFee) {
  if (!promotionId) {
    return { promotionApplied: null, discount: 0, reason: null };
  }
  const promotion = readPromotions().find(
    (p) => p.id.toLowerCase() === promotionId.toLowerCase()
  );
  if (!promotion) {
    return { promotionApplied: null, discount: 0, reason: `Unknown promotion "${promotionId}".` };
  }
  if (!promotion.active) {
    return {
      promotionApplied: null,
      discount: 0,
      reason: `Promotion "${promotion.name}" is not currently active.`,
    };
  }
  const percent = promotion.feeDiscountPercent;
  if (promotion.appliesToFee !== true || typeof percent !== "number" || !(percent >= 0 && percent <= 100)) {
    return {
      promotionApplied: null,
      discount: 0,
      reason: `Promotion "${promotion.name}" does not apply to inquiry fees.`,
    };
  }
  return { promotionApplied: promotion.id, discount: round2(baseFee * (percent / 100)), reason: null };
}

function calculateInquiryFee(input, inquiryState) {
  const baseFee = FEE_CONFIG.feesByInquiryType[inquiryState.inquiryType] || 0;
  const tax = round2(baseFee * FEE_CONFIG.taxRate);

  const promotionId =
    input && typeof input.promotionId === "string" && input.promotionId.trim()
      ? input.promotionId.trim()
      : null;
  const { promotionApplied, discount, reason } = resolvePromotionForFee(promotionId, baseFee);

  const finalFee = Math.max(0, round2(baseFee + tax - discount));

  return {
    success: true,
    baseFee,
    tax,
    discount,
    finalFee,
    currency: FEE_CONFIG.currency,
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
      "inquiry type, preferred date/time, customer details provided so far, message, status, and " +
      "confirmation status. Use this when the user asks to see, review, or confirm what's currently " +
      "in their inquiry. Does not modify anything and never includes prices, totals, or discounts.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "getInquiryRequirements",
    description:
      "Check what's still needed before the user's current viewing request/inquiry could be " +
      "submitted: a selected property, the customer's name, and the customer's phone number are " +
      "required; preferred viewing date/time, the customer's own address/unit, and any viewing " +
      "instructions are optional and never block readiness. Use this before asking the user for any " +
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
      "Get the final confirmation summary for the current inquiry/viewing request — property name, " +
      "verified property location (from data/properties.json), inquiry type, preferred date/time, " +
      "customer name/phone/unit, and any viewing instructions, using only what's actually stored in " +
      "the session. Call this before asking for final confirmation, and again after any correction. " +
      "Read this tool's own `notes` field for exactly how to present the summary and what counts as " +
      "explicit confirmation. Read-only — never modifies or submits anything by itself.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "confirmInquiry",
    description:
      "Finalize the current inquiry/viewing request. Only call this after you have shown the full " +
      "confirmation summary (from getInquiryConfirmationSummary) and the customer has given a clear, " +
      "explicit confirmation such as 'yes', 'confirm', or 'that's correct' — never for vague replies " +
      "like 'okay' or 'sounds good', and never based on silence or the absence of a correction. If the " +
      "customer indicates anything is wrong, do not call this — use updatePropertyInquiry or " +
      "removePropertyFromInquiry instead, then re-show the summary and get explicit confirmation again. " +
      "Fails with a clear error (and never confirms) if required information is still missing or the " +
      "selected property is no longer available.",
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
      "unless the project defines a real one. Only pass promotionId if the customer explicitly names a " +
      "specific promotion; never guess or invent one. Report exactly the baseFee, tax, discount, and " +
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
