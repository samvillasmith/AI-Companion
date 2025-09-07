"use client";

import { Button } from "./ui/button";
import { ChevronLeft, MessagesSquare, MoreVertical, Edit, Trash } from "lucide-react";
import { BotAvatar } from "./bot-avatar";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "./ui/dropdown-menu";
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
    <div className="flex w-full justify-between items-center border-b border-border pb-4">
      <div className="flex gap-x-2 items-center">
        <Button size="icon" variant="ghost">
          <Link href="/" aria-label="Back to home">
            <ChevronLeft className="h-8 w-8" onClick={() => router.push(`/`)} />
          </Link>
        </Button>

        <BotAvatar src={companion.src} />

        <div className="flex flex-col gap-y-1">
          <div className="flex items-center gap-x-2">
            {/* tiny accent only in dark mode */}
            <div className="h-2 w-2 rounded-full bg-indigo-500/60 dark:bg-gradient-to-r dark:from-sky-400 dark:via-indigo-500 dark:to-fuchsia-500" />
            <p className="font-bold text-foreground">{companion.name}</p>
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
            <Button variant="ghost" size="icon" className="bg-muted hover:bg-muted/80">
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-background text-foreground border border-border">
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
  );
};
