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
      // call the api directly - INCLUDE CATEGORY!
      const res = await fetch(`/api/chat/${companion.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: text,
          category: companion.categoryId, // Pass the category ID
        }),
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
    <div className="flex flex-col h-full p-4 space-y-2">
      <ChatHeader companion={companion} />
      <ChatMessages
        companion={companion}
        isLoading={isLoading}
        messages={messages}
      />
      <ChatForm
        isLoading={isLoading}
        input={input}
        handleInputChange={handleInputChange}
        onSubmit={onSubmit}
      />
    </div>
  );
};