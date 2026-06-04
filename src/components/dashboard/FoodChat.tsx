"use client";

import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { FoodItem } from "@/types";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface FoodChatProps {
  currentItems: FoodItem[];
  onItemsUpdated: (items: FoodItem[]) => void;
  date: string;
}

export default function FoodChat({ currentItems, onItemsUpdated, date }: FoodChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setError("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", text }]);

    try {
      const res = await fetch("/api/food/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, currentItems, date }),
      });

      if (!res.ok) {
        setError("Could not process that. Try rephrasing.");
        setSending(false);
        return;
      }

      const { items, reply } = await res.json();
      onItemsUpdated(items);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="space-y-3">
      {messages.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background border text-foreground"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          placeholder={
            currentItems.length === 0
              ? "What did you eat? e.g. 2 eggs, toast with butter, coffee"
              : `Add more food or modify the log — e.g. "remove the toast" or "add an apple"`
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={sending}
          className="resize-none"
        />
        <Button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="self-end shrink-0"
        >
          {sending ? "…" : "Send"}
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {messages.length > 0 && (
        <p className="text-xs text-muted-foreground">Press Enter to send · Shift+Enter for new line</p>
      )}
    </div>
  );
}
