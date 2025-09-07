/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { Companion, Message } from "@prisma/client";

import { ChatHeader } from "../../../../../../components/chat-header";
import { ChatMessages } from "../../../../../../components/chat-messages";
import { ChatForm } from "../../../../../../components/chat-form";
import type { ChatMessageProps } from "../../../../../../components/chat-message";

interface ChatClientProps {
  companion: Companion & {
    messages: Message[];
    _count: { messages: number };
  };
}

export const ChatClient = ({ companion }: ChatClientProps) => {
  // Seed from DB (roles in DB are "user" and "system")
  const [messages, setMessages] = useState<ChatMessageProps[]>(
    (companion.messages as any).map((m: Message) => ({
      role: m.role as "user" | "system",
      content: m.content ?? "",
    }))
  );

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement> | any
  ) => setInput(e.target?.value ?? "");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    // 1) show user bubble immediately
    setMessages((cur) => [...cur, { role: "user", content: text }]);
    setIsLoading(true);

    try {
      // 2) call your API directly (non-streaming plain text)
      const res = await fetch(`/api/chat/${companion.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });

      const reply = (await res.text()).trim();

      // 3) append bot bubble with actual text
      setMessages((cur) => [
        ...cur,
        {
          role: "system", 
          content: reply || "I'm here—tell me more?",
        },
      ]);
    } catch (err) {
      console.error("chat error", err);
      setMessages((cur) => [
        ...cur,
        { role: "system", content: "Sorry, I hit an error. Try again?" },
      ]);
    } finally {
      setIsLoading(false);
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-6xl mx-auto w-full">
      {/* Header - fixed height */}
      <div className="flex-shrink-0 border-b">
        <ChatHeader companion={companion} />
      </div>
      
      {/* Messages - flexible height with scroll */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4">
          <ChatMessages
            companion={companion}
            isLoading={isLoading}
            messages={messages}
          />
        </div>
      </div>
      
      {/* Input form - fixed at bottom */}
      <div className="flex-shrink-0 border-t bg-background">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <ChatForm
            isLoading={isLoading}
            input={input}
            handleInputChange={handleInputChange}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  );
};