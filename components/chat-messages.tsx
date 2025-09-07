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
 *  - Extra TOP padding + spacer clears sticky header.
 *  - Extra BOTTOM padding clears sticky composer (and keyboard via --kb).
 *  - Sets CSS var --kb using visualViewport so composer can dodge the keyboard.
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

  // ---- keyboard-aware inset for iOS Safari
  useEffect(() => {
    const el = window.visualViewport;
    if (!el) return;
    const update = () => {
      const inset = Math.max(0, (window.innerHeight || 0) - el.height);
      document.documentElement.style.setProperty("--kb", `${inset}px`);
    };
    update();
    el.addEventListener("resize", update);
    el.addEventListener("scroll", update);
    return () => {
      el.removeEventListener("resize", update);
      el.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div
      className={[
        "flex-1 min-h-0 pr-4",
        // 👇 more clearance so first bubble never sits under header on phones
        "pt-12 sm:pt-6",
        // 👇 keep the last message clear of the composer + safe-area + keyboard
        "pb-[calc(env(safe-area-inset-bottom)+var(--kb,0px)+120px)] sm:pb-[calc(env(safe-area-inset-bottom)+96px)]",
        // single scroll area on mobile; allow inner scroll on md+
        "overflow-visible md:overflow-y-auto",
      ].join(" ")}
      // when you programmatically scroll, don't let anchors tuck under header
      style={{ scrollPaddingTop: "88px" }} // ~ header height on mobile
    >
      {/* safety spacer below sticky header */}
      <div className="h-1.5 sm:h-1" />

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

      {/* Anchor for auto-scroll; margin prevents tucking under the composer */}
      <div ref={scrollRef} className="h-1" style={{ scrollMarginBottom: "9rem" }} />
    </div>
  );
};
