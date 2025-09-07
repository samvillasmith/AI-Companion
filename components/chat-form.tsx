"use client";

import { ChangeEvent, FormEvent } from "react";
import { ChatRequestOptions } from "@ai-sdk/react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { SendHorizontal } from "lucide-react";

interface ChatFormProps {
  input: string;
  handleInputChange: (e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextArea>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>, ChatRequestOptions?: ChatRequestOptions | undefined) => void;
  isLoading: boolean;
}

export const ChatForm = ({ input, handleInputChange, onSubmit, isLoading }: ChatFormProps) => {
  return (
    <form onSubmit={onSubmit} className="border-t border-border py-4 flex items-center gap-x-2">
      <div className="relative flex-1 rounded-xl bg-muted ring-1 ring-border focus-within:ring-2 focus-within:ring-indigo-400/40">
        <Input
          disabled={isLoading}
          value={input}
          onChange={handleInputChange}
          placeholder="Write your message..."
          className="h-12 rounded-xl border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
        />
      </div>
      <Button disabled={isLoading} variant="ghost" className="text-foreground hover:bg-muted">
        <SendHorizontal className="h-6 w-6" />
      </Button>
    </form>
  );
};
