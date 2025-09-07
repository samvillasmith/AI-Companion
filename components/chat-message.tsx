/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BotAvatar } from "./bot-avatar";
import { UserAvatar } from "./user-avatar";
import { BeatLoader } from "react-spinners";
import { Button } from "./ui/button";
import { Copy } from "lucide-react";

export interface ChatMessageProps {
  role: "system" | "assistant" | "user";
  content?: string;
  isLoading?: boolean;
  src?: string;
}

export const ChatMessage = ({ role, content, isLoading, src }: ChatMessageProps) => {
  const isUser = role === "user";

  const onCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    toast("Message Copied");
  };

  return (
    <div className={cn("group flex items-start gap-x-3 py-4 w-full", isUser && "justify-end")}>
      {!isUser && src && <BotAvatar src={src} />}

      <div
        className={cn(
          "rounded-lg px-4 py-2 max-w-[75%] text-sm shadow-sm border",
          isUser
            ? "bg-accent text-foreground border-border dark:bg-white/10 dark:text-foreground dark:border-white/10"
            : "bg-muted text-foreground border-border dark:bg-white/5 dark:text-foreground dark:border-white/10"
        )}
      >
        {isLoading ? <BeatLoader color="currentColor" size={5} /> : content}
      </div>

      {isUser && <UserAvatar />}

      {!isUser && !isLoading && (
        <Button
          onClick={onCopy}
          className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-foreground"
          size="icon"
          variant="ghost"
          aria-label="Copy message"
        >
          <Copy className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};
