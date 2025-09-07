"use client";

import { useState, useEffect, useRef, ElementRef } from "react";
import { Companion } from "@prisma/client";
import { ChatMessage, ChatMessageProps } from "./chat-message";

interface ChatMessagesProps {
  messages: ChatMessageProps[];
  isLoading: boolean;
  companion: Companion;
}

/**
 * Mobile layout:
 *  - Page is the only scroll container.
 *  - Extra TOP padding + an explicit spacer clear the sticky header.
 *  - Extra BOTTOM padding clears the sticky composer.
 */
export const ChatMessages = ({ messages = [], isLoading, companion }: ChatMessagesProps) => {
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
    <div
      className={[
        "flex-1 min-h-0 pr-4",
        // ↑↑ give the list room under the sticky header
        "pt-8 sm:pt-6",
        // ↑↑ keep the last message above the composer
        "pb-[calc(env(safe-area-inset-bottom)+104px)] sm:pb-[calc(env(safe-area-inset-bottom)+112px)]",
        // single scroll area on mobile; allow inner scroll on md+
        "overflow-visible md:overflow-y-auto",
      ].join(" ")}
    >
      {/* extra safety spacer so the very first bubble never tucks under header */}
      <div className="h-3 sm:h-2" />

      {/* Initial greeting */}
      <ChatMessage
        isLoading={greetTyping}
        src={companion.src}
        role="system"
        content={`Hey, I'm ${companion.name}, a ${companion.description}.`}
      />

      {/* Conversation */}
      {messages.map((m, i) => (
        <ChatMessage
          key={`${i}-${m.role}-${(m.content ?? "").slice(0, 24)}`}
          role={m.role}
          content={m.content}
          src={m.role !== "user" ? companion.src : undefined}
        />
      ))}

      {/* Typing bubble while waiting for server */}
      {isLoading && <ChatMessage role="system" src={companion.src} isLoading />}

      {/* Anchor for auto-scroll; margin prevents it from sliding under the composer */}
      <div ref={scrollRef} className="h-1" style={{ scrollMarginBottom: "8rem" }} />
    </div>
  );
};
