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
    },
    preferredDate: null,
    preferredTime: null,
    message: null,
    discount: null,
    total: null,
    confirmed: false,
    status: "draft",
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
      return { success: false, error: "customerDetails must be an object with name, email, and/or phone." };
    }
    customerDetailsUpdates = {};
    for (const field of ["name", "email", "phone"]) {
      if (input.customerDetails[field] !== undefined) {
        if (typeof input.customerDetails[field] !== "string" || !input.customerDetails[field].trim()) {
          return { success: false, error: `customerDetails.${field} must be a non-empty string.` };
        }
        customerDetailsUpdates[field] = input.customerDetails[field].trim();
      }
    }
    if (Object.keys(customerDetailsUpdates).length === 0) {
      return { success: false, error: "customerDetails must include at least one of name, email, or phone." };
    }
  }

  if (Object.keys(updates).length === 0 && !customerDetailsUpdates) {
    return { success: false, error: "No recognized update fields were provided." };
  }

  Object.assign(inquiryState, updates);
  if (customerDetailsUpdates) {
    Object.assign(inquiryState.customerDetails, customerDetailsUpdates);
  }

  return { success: true, inquiryState };
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
        message: { type: "string", description: "Customer-provided message or preferences." },
        customerDetails: {
          type: "object",
          description: "Any of the customer's contact details the user provided.",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
          },
        },
      },
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
