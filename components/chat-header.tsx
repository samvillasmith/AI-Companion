"use client";

import { Button } from "./ui/button";
import { ChevronLeft } from "lucide-react";

interface ChatHeaderProps {
    companion: Companion & {
        messages: Message[];
        _count: {
            messages: number;
        };
    };
};

export const ChatHeader = ({
    companion
}: ChatHeaderProps) => {
    return ( 
        <div className="flex w-full justify-between items-center border-b border-primary/10 pb-4">
            <div className="flex gap-x-2 items-center">
                <Button size="icon" variant="ghost">
                    <ChevronLeft className="h-8 w-8"/>
                </Button>
            </div>
        </div>
     );
};