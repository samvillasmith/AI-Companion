"use client";

import { ChangeEvent, FormEvent } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { SendHorizontal } from "lucide-react";

interface ChatFormProps {
  input: string;
  // Fix incorrect type: HTMLTextAreaElement (not HTMLTextArea)
  handleInputChange: (
    e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>
  ) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void; // <- simplified: single arg
  isLoading: boolean;
}

export const ChatForm = ({
  input,
  handleInputChange,
  onSubmit,
  isLoading,
}: ChatFormProps) => {
  return (
    <div className="border-t border-border bg-background/95 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-x-2"
      >
        <div className="relative flex-1 rounded-full bg-muted/50 ring-1 ring-border/50 focus-within:ring-2 focus-within:ring-indigo-400/40 transition-all">
          <Input
            disabled={isLoading}
            value={input}
            onChange={handleInputChange}
            placeholder="Write your message..."
            className="h-11 rounded-full border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0 px-5"
          />
        </div>
        <Button
          disabled={isLoading}
          variant="default"
          size="icon"
          className="h-11 w-11 rounded-full bg-primary hover:bg-primary/90 transition-all"
          type="submit"
        >
          <SendHorizontal className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
};