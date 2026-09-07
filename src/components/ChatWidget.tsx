"use client";

import { useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";

interface ChatMessage {
  id: number;
  sender: "user" | "bot";
  text: string;
}

/**
 * Ported 1:1 from the original app.js mock chat widget. Still a mock —
 * CLAUDE.md's planned backend/ (ANTHROPIC_API_KEY in .env.example) isn't
 * built yet. Once it is, replace handleSubmit's setTimeout with a fetch to
 * an /api/chat route that calls the Anthropic API server-side (never
 * expose that key to the client).
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const userMessage: ChatMessage = { id: Date.now(), sender: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "bot",
          text: "Hi! I'm Muhammad Nadeem. My AI brain isn't connected yet.",
        },
      ]);
    }, 600);
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
              className="min-w-0 flex-1 rounded-full border border-border bg-bg px-4 py-2.5 text-sm"
            />
            <button
              type="submit"
              aria-label="Send message"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-primary-dark hover:bg-accent-dark hover:text-white"
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
