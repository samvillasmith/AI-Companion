"use client";

import { Sparkles } from "lucide-react";
import { Poppins } from "next/font/google";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Button } from "./ui/button";
import { ModeToggle } from "./mode-toggle";
import { MobileSidebar } from "./mobile-sidebar";
import { usePremiumModal } from "../hooks/use-premium-modal";
import { cn } from "@/lib/utils";

const font = Poppins({ weight: "600", subsets: ["latin"] });

interface NavbarProps { isPremium: boolean; }

export const Navbar = ({ isPremium }: NavbarProps) => {
  const premiumModal = usePremiumModal();

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 h-16 px-4 py-2",
        "flex items-center justify-between bg-background"
      )}
    >
      {/* subtle hairline under navbar (visible in both themes, stronger in dark) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/25 to-transparent dark:via-fuchsia-500/40" />

      <div className="flex items-center gap-2">
        <MobileSidebar isPremium={isPremium}/>
        <Link href="/" className="select-none">
          <h1
            className={cn(
              "hidden md:block text-xl md:text-3xl font-bold tracking-wide",
              "text-foreground",
              "dark:bg-gradient-to-r dark:from-sky-400 dark:via-indigo-400 dark:to-fuchsia-400 dark:bg-clip-text dark:text-transparent",
              font.className
            )}
          >
            TELMII
          </h1>
        </Link>
      </div>

      <div className="flex items-center gap-x-3">
        {!isPremium && (
          <Button onClick={premiumModal.onOpen} variant="premium" size="sm">
            Upgrade
            <Sparkles className="h-4 w-4 ml-1 fill-white text-white" />
          </Button>
        )}
        <ModeToggle />
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
};
