// components/chat-composer.tsx
"use client";

import * as React from "react";
import { Button } from "./ui/button";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ChatComposer
 * - Stays pinned at the bottom of the screen
 * - Keyboard-aware on iOS (uses CSS var --kb set by ChatMessages via visualViewport)
 * - Self-measures (data-chat-composer) so ChatMessages can compute exact height
 * - Auto-resizes textarea up to 6 rows; Enter sends, Shift+Enter makes a newline
 */
export function ChatComposer({
  className,
  placeholder = "Write your message...",
  isSending = false,
  disabled = false,
  onSend,
}: {
  className?: string;
  placeholder?: string;
  isSending?: boolean;
  disabled?: boolean;
  onSend: (text: string) => Promise<void> | void;
}) {
  const [value, setValue] = React.useState("");
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  // autosize textarea up to 6 rows
  React.useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 6 * 24 + 20); // 6 rows (roughly)
    el.style.height = next + "px";
  }, [value]);

  const doSend = async () => {
    const text = value.trim();
    if (!text || disabled || isSending) return;
    setValue("");
    await onSend(text);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void doSend();
    }
  };

  return (
    <div
      data-chat-composer
      className={cn(
        // sticky bottom bar; spans full width (matching page padding via negative margins)
        "sticky z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-3",
        "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 border-t border-border",
        className
      )}
      // sit above the iOS home indicator + keyboard (var(--kb) is set by ChatMessages)
      style={{ bottom: "calc(env(safe-area-inset-bottom) + var(--kb, 0px))" }}
    >
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <div
              className={cn(
                "rounded-2xl border border-border bg-muted/60 dark:bg-white/5",
                "px-3 py-2"
              )}
            >
              <textarea
                id="chat-input"
                ref={taRef}
                value={value}
                placeholder={placeholder}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                className={cn(
                  "w-full resize-none bg-transparent outline-none",
                  "text-foreground placeholder:text-muted-foreground",
                  "leading-6"
                )}
                aria-label="Write your message"
                disabled={disabled || isSending}
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={doSend}
            disabled={disabled || isSending || !value.trim()}
            className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            aria-label="Send message"
          >
            <SendHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ChatComposer;
