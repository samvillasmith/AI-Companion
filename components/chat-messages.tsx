"use client";

import { useState, useEffect, useRef } from "react";
import { Companion } from "@prisma/client";
import { ChatMessage, ChatMessageProps } from "./chat-message";

interface ChatMessagesProps {
    messages: ChatMessageProps[];
    isLoading: boolean;
    companion: Companion;
}

export const ChatMessages = ({
    messages = [],
    isLoading,
    companion
}: ChatMessagesProps) => {

    const scrollRef = useRef<ElementRef<"div">>(null);

    const [greetTyping, setGreetTyping] = useState(messages.length === 0 ? true : false);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setGreetTyping(false)
        }, 1000);
        return () => {
            clearTimeout(timeout); 
        }
    }, [messages.length]);

    useEffect(() => {
        scrollRef?.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    return ( 
        <div className="flex-1 overflow-y-auto pr-4">
            <ChatMessage 
                isLoading={greetTyping}
                src={companion.src}
                role="system"
                content={`"Hey, I'm ${companion.name}, ${companion.description}`}
            />
            {messages.map((message) => (
                <ChatMessage 
                    key={message.content}
                    role={message.role}
                    content={message.content}
                    src={message.src}
                />
                ))}
            {isLoading && (
                <ChatMessage 
                role="system"
                src={companion.src}
                isLoading
            />
        )}
        <div ref={scrollRef} />
        </div>
     );
}