const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use(express.json());

app.post("/api/chat", (req, res) => {
  const { message, conversationHistory } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  res.json({
    reply: "Hi! I'm Muhammad Nadeem. My AI brain isn't connected yet.",
    conversationHistory: conversationHistory || [],
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
