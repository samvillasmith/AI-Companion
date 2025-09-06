"use client";

import { useState, useEffect, useRef, ElementRef } from "react";
import { Companion } from "@prisma/client";
import { ChatMessage, ChatMessageProps } from "./chat-message";

interface ChatMessagesProps {
  messages: ChatMessageProps[];
  isLoading: boolean;
  companion: Companion;
}

export const ChatMessages = ({
  messages = [],
  isLoading,
  companion,
}: ChatMessagesProps) => {
  const scrollRef = useRef<ElementRef<"div">>(null);
  const [greetTyping, setGreetTyping] = useState(messages.length === 0);

  useEffect(() => {
    const t = setTimeout(() => setGreetTyping(false), 1000);
    return () => clearTimeout(t);
  }, [messages.length]);

  useEffect(() => {
    scrollRef?.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto pr-4">
      {/* Initial greeting */}
      <ChatMessage
        isLoading={greetTyping}
        src={companion.src}
        role="system"
        content={`Hey, I'm ${companion.name}, and I'm a ${companion.description}.`}
      />

      {/* Conversation */}
      {messages.map((m, i) => (
        <ChatMessage
          key={`${i}-${m.role}-${(m.content ?? "").slice(0, 24)}`} // stable key even if content is empty
          role={m.role}
          content={m.content}
          // Always pass avatar for bot messages
          src={m.role !== "user" ? companion.src : undefined}
        />
      ))}

      {/* Typing bubble while waiting for server */}
      {isLoading && <ChatMessage role="system" src={companion.src} isLoading />}

      <div ref={scrollRef} />
    </div>
  );
};
