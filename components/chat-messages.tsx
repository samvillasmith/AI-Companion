// components/chat-messages.tsx
"use client";

import { useState, useEffect, useRef, ElementRef } from "react";
import type { Companion } from "@prisma/client";
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
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div 
      className="flex-1 overflow-y-auto overscroll-contain px-4"
      style={{
        // Use CSS env() for safe areas on iOS
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="max-w-2xl mx-auto py-4">
        {/* Greeting */}
        <ChatMessage
          isLoading={greetTyping}
          src={companion.src}
          role="system"
          content={`Hey, I'm ${companion.name}, a ${companion.description}.`}
        />

        {/* Thread */}
        {messages.map((m, i) => (
          <ChatMessage
            key={`${i}-${m.role}-${(m.content ?? "").slice(0, 24)}`}
            role={m.role}
            content={m.content}
            src={m.role !== "user" ? companion.src : undefined}
          />
        ))}

        {/* Typing bubble while server is working */}
        {isLoading && <ChatMessage role="system" src={companion.src} isLoading />}

        {/* Anchor for autoscroll */}
        <div ref={scrollRef} className="h-4" />
      </div>
    </div>
  );
};

export default ChatMessages;