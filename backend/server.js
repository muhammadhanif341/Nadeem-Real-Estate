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
];

async function runToolCall(toolUseBlock, inquiryState) {
  if (toolUseBlock.name === "getProperties") {
    return getAvailableProperties();
  }
  if (toolUseBlock.name === "addPropertyToInquiry") {
    return addPropertyToInquiry(toolUseBlock.input, inquiryState);
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
