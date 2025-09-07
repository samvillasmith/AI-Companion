"use client";

import { useState, useEffect, useRef, ElementRef } from "react";
import type { Companion } from "@prisma/client";
import { ChatMessage, ChatMessageProps } from "./chat-message";

interface ChatMessagesProps {
  messages: ChatMessageProps[];
  isLoading: boolean;
  companion: Companion;
}

/**
 * Mobile-fit layout:
 *  - Only this list scrolls.
 *  - We measure header/composer/viewport and:
 *      * set list height = vh - header - composer
 *      * add padding-top = header + 8px so the first bubble never sits under it.
 *  - Keyboard-aware via CSS var --kb.
 */
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

  // Measure header + composer + viewport; expose as CSS vars
  useEffect(() => {
    const updateVars = () => {
      const vv = window.visualViewport;
      const vh = vv?.height ?? window.innerHeight ?? 0;

      const header = document.querySelector("[data-chat-header]") as HTMLElement | null;
      const composer = document.querySelector("[data-chat-composer]") as HTMLElement | null;

      const hHeader = header?.getBoundingClientRect().height ?? 0;
      const hComposer = composer?.getBoundingClientRect().height ?? 0;

      const kb = Math.max(0, (window.innerHeight || vh) - vh); // keyboard height approx

      const root = document.documentElement;
      root.style.setProperty("--vh", `${vh}px`);
      root.style.setProperty("--h-header", `${hHeader}px`);
      root.style.setProperty("--h-composer", `${hComposer}px`);
      root.style.setProperty("--kb", `${kb}px`);
    };

    updateVars();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", updateVars);
    vv?.addEventListener("scroll", updateVars);

    const ro = new ResizeObserver(updateVars);
    const header = document.querySelector("[data-chat-header]") as HTMLElement | null;
    const composer = document.querySelector("[data-chat-composer]") as HTMLElement | null;
    header && ro.observe(header);
    composer && ro.observe(composer);

    window.addEventListener("resize", updateVars);

    return () => {
      vv?.removeEventListener("resize", updateVars);
      vv?.removeEventListener("scroll", updateVars);
      ro.disconnect();
      window.removeEventListener("resize", updateVars);
    };
  }, []);

  return (
    <div
      style={{
        // exact height so page never scrolls; only this list does
        height:
          "calc(var(--vh, 100svh) - var(--h-header, 56px) - var(--h-composer, 72px))",
        // push content fully below the sticky header
        paddingTop: "calc(var(--h-header, 56px) + 8px)",
        // keep the last bubble clear of the composer
        paddingBottom:
          "calc(env(safe-area-inset-bottom) + var(--kb, 0px) + 12px)",
        // anchor scroll should account for header height
        scrollPaddingTop: "calc(var(--h-header, 56px) + 8px)",
      }}
      className="min-h-0 pr-4 overflow-y-auto overscroll-contain"
    >
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

      {/* Anchor for autoscroll; keep above composer */}
      <div ref={scrollRef} style={{ height: 1, scrollMarginBottom: "80px" }} />
    </div>
  );
};

export default ChatMessages;
