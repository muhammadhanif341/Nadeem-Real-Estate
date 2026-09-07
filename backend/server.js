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

app.post("/api/chat", async (req, res) => {
  const { message, conversationHistory } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: fullSystemPrompt,
      messages: [...(conversationHistory || []), { role: "user", content: message }],
    });

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
