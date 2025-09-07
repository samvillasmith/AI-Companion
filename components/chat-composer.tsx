// components/chat-composer.tsx
"use client";

import * as React from "react";
import { Button } from "./ui/button";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

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

  // Autosize textarea up to 4 rows (better for mobile)
  React.useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "40px"; // Reset to single line height
    const maxHeight = 4 * 24; // 4 rows max
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = newHeight + "px";
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
      className={cn(
        "flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 border-t border-border",
        className
      )}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="px-4 py-3">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <div className="flex-1">
            <textarea
              ref={taRef}
              value={value}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              className={cn(
                "w-full resize-none bg-muted/60 dark:bg-white/5",
                "rounded-2xl border border-border",
                "px-4 py-2.5",
                "text-foreground placeholder:text-muted-foreground",
                "outline-none focus:ring-2 focus:ring-primary/20",
                "min-h-[40px] leading-6"
              )}
              rows={1}
              disabled={disabled || isSending}
              aria-label="Write your message"
            />
          </div>

          <Button
            type="button"
            onClick={doSend}
            disabled={disabled || isSending || !value.trim()}
            className="h-10 w-10 rounded-full p-0 flex-shrink-0"
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