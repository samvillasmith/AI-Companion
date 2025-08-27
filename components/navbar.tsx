"use client";

import { Menu, Sparkles } from "lucide-react";
import { Poppins } from "next/font/google";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Button } from "./ui/button";
import { ModeToggle } from "./mode-toggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import { MobileSidebar } from "../components/mobile-sidebar";

import { cn } from "@/lib/utils";

const font = Poppins({
    weight: "600",
    subsets: ["latin"]
});

export const Navbar = () => {
    return ( 
        <div className="fixed 
        w-full 
        z-50 flex 
        justify-between 
        items-center 
        py-2 
        px-4 
        border-b 
        border-primary/10 
        bg-secondary
        h-16">
            <div className="flex items-center">
                <MobileSidebar />
                <Link href="/">
                    <h1 className={cn(
                        "hidden md:block text-xl md:text-3xl font-bold text-priamary",
                        font.className
                        )}>
                        hellofriend.ai
                    </h1>
                </Link>
            </div>
            <div className="flex items-center gap-x-3">
                <Button variant="premium" size="sm">
                    Premium
                    <Sparkles className="h-4 w-4 fill-white text-white"/>
                </Button>
                <ModeToggle />
                <UserButton />
            </div>
        </div>
     );
}

