"use client";

import { toast } from "sonner";
import { useTheme } from "next-themes";
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


export const ChatMessage = ({
  role,
  content,
  isLoading,
  src,
}: ChatMessageProps) => {
  const { theme } = useTheme();

  const onCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    toast("Message Copied");
  };

  const isUser = role === "user";

  return (
    <div className={cn("group flex items-start gap-x-3 py-4 w-full", isUser && "justify-end")}>
      {!isUser && src && <BotAvatar src={src} />}
      <div className="rounded-md px-4 py-2 max-w-sm text-sm bg-primary/10">
        {isLoading ? (
          <BeatLoader color={theme === "light" ? "black" : "white"} size={5} />
        ) : (
          content
        )}
      </div>
      {isUser && <UserAvatar />}
      {!isUser && !isLoading && (
        <Button
          onClick={onCopy}
          className="opacity-0 group-hover:opacity-100 transition"
          size="icon"
          variant="ghost"
        >
          <Copy className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};
