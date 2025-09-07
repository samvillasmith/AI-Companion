// components/chat-header.tsx
"use client";

import { Button } from "./ui/button";
import { ChevronLeft, MessagesSquare, MoreVertical, Edit, Trash } from "lucide-react";
import { BotAvatar } from "./bot-avatar";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { toast } from "sonner";
import axios from "axios";
import Link from "next/link";
import type { Companion, Message } from "@prisma/client";

interface ChatHeaderProps {
  companion: Companion & { messages: Message[]; _count: { messages: number } };
}

export const ChatHeader = ({ companion }: ChatHeaderProps) => {
  const router = useRouter();
  const { user } = useUser();

  const onDelete = async () => {
    try {
      await axios.delete(`/api/companion/${companion.id}`);
      toast("Success!", { description: "Your companion was deleted." });
      router.refresh();
      router.push("/");
    } catch {
      toast("Something went wrong.", { description: "Please try again." });
    }
  };

  return (
    <div className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 border-b border-border">
      <div className="px-4 py-3">
        <div className="flex w-full justify-between items-center">
          <div className="flex gap-x-2 items-center">
            <Button size="icon" variant="ghost">
              <Link href="/" aria-label="Back to home">
                <ChevronLeft className="h-6 w-6" />
              </Link>
            </Button>

            <BotAvatar src={companion.src} />

            <div className="flex flex-col">
              <div className="flex items-center gap-x-2">
                <p className="font-semibold text-sm">{companion.name}</p>
                <div className="flex items-center text-xs text-muted-foreground">
                  <MessagesSquare className="w-3 h-3 mr-1" />
                  {companion._count.messages}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Created by {companion.userName}</p>
            </div>
          </div>

          {user?.id === companion.userId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/companion/${companion.id}`)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete}>
                  <Trash className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;