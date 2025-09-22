"use client";

import { useState } from "react";

export default function ChatInput({ chatId }: { chatId: string }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const input = value.trim();
    if (!input || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/${chatId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: input }), // <-- simple & compatible
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("SEND_ERR", data);
        // surface toast in your UI if you want
      }
      setValue("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <input
        className="flex-1 bg-neutral-900 text-white px-3 py-2 rounded"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Write your message…"
      />
      <button
        className="px-3 py-2 rounded bg-white/10"
        onClick={send}
        disabled={loading}
      >
        Send
      </button>
    </div>
  );
}
