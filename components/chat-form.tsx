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
    <form
      onSubmit={onSubmit}
      className="border-t border-border py-4 flex items-center gap-x-2"
    >
      <div className="relative flex-1 rounded-xl bg-muted ring-1 ring-border focus-within:ring-2 focus-within:ring-indigo-400/40">
        <Input
          disabled={isLoading}
          value={input}
          onChange={handleInputChange}
          placeholder="Write your message..."
          className="h-12 rounded-xl border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
        />
      </div>
      <Button
        disabled={isLoading}
        variant="ghost"
        className="text-foreground hover:bg-muted"
        type="submit"
      >
        <SendHorizontal className="h-6 w-6" />
      </Button>
    </form>
  );
};
