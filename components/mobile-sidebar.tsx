"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";

interface MobileSidebarProps {
  isPremium: boolean;
}

export function MobileSidebar({ isPremium }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* super minimal sheet; replace with your Sheet component if you have one */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-y-0 left-0 w-64 bg-background p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar isPremium={isPremium} />
          </div>
        </div>
      )}
    </div>
  );
}
