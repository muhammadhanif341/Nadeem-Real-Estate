"use client";

import { useRef, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";

interface ChatMessage {
  id: number;
  sender: "user" | "bot";
  text: string;
}

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

const ERROR_REPLY = "Sorry, something went wrong. Please try again in a moment.";

/**
 * Talks to /api/chat, the real Claude-powered support agent (ported from
 * backend/server.js — see that file's history for the tool/inquiry design).
 * conversationHistory is kept client-side and sent as "everything before
 * this message", matching the contract the legacy frontend/app.js chat
 * already used against the same backend logic.
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const conversationHistory = useRef<ConversationTurn[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const historyForRequest = conversationHistory.current.slice();

    setMessages((prev) => [...prev, { id: Date.now(), sender: "user", text }]);
    conversationHistory.current.push({ role: "user", content: text });
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationHistory: historyForRequest }),
      });
      if (!response.ok) throw new Error("Chat request failed");
      const data = await response.json();
      if (!data.reply) throw new Error("Chat response missing reply");

      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: "bot", text: data.reply }]);
      conversationHistory.current.push({ role: "assistant", content: data.reply });
    } catch {
      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: "bot", text: ERROR_REPLY }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed right-6 bottom-6 z-[200] flex flex-col items-end gap-4">
      {open ? (
        <div className="flex h-[500px] w-[360px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex flex-shrink-0 items-center justify-between gap-3 bg-gradient-to-br from-primary to-primary-dark p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-accent font-heading font-bold text-primary-dark">
                N
              </span>
              <div>
                <p className="text-sm font-bold text-text-inverse">
                  Nadeem Real Estate
                </p>
                <p className="text-xs text-text-inverse/70">
                  Usually replies right away
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="flex flex-shrink-0 items-center justify-center rounded-full p-1.5 text-text-inverse/85 hover:bg-text-inverse/[0.14]"
            >
              <X size={20} />
            </button>
          </div>

          <div
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
            className="flex flex-1 flex-col gap-2.5 overflow-y-auto bg-bg p-[18px]"
          >
            {messages.length === 0 ? (
              <p className="m-auto text-center text-sm text-text-muted">
                Send Nadeem a message to start the conversation.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-md px-3.5 py-2.5 text-sm ${
                    m.sender === "user"
                      ? "self-end rounded-br-sm bg-accent text-primary-dark"
                      : "self-start rounded-bl-sm border border-border bg-surface text-text"
                  }`}
                >
                  {m.text}
                </div>
              ))
            )}
            {sending ? (
              <div className="max-w-[80%] self-start rounded-md rounded-bl-sm border border-border bg-surface px-3.5 py-2.5 text-sm text-text-muted">
                Typing…
              </div>
            ) : null}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-shrink-0 items-center gap-2.5 border-t border-border bg-surface p-3.5"
          >
            <label htmlFor="chatInput" className="sr-only">
              Type your message
            </label>
            <input
              id="chatInput"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              autoComplete="off"
              disabled={sending}
              className="min-w-0 flex-1 rounded-full border border-border bg-bg px-4 py-2.5 text-sm disabled:opacity-60"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={sending}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-primary-dark hover:bg-accent-dark hover:text-white disabled:opacity-60"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-label="Open chat"
        className={`flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-full bg-accent text-primary-dark shadow-lg hover:-translate-y-0.5 hover:bg-accent-dark hover:text-white ${
          open ? "hidden" : ""
        }`}
      >
        <MessageSquare size={26} />
      </button>
    </div>
  );
}
