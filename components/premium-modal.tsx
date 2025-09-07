// components/premium-modal.tsx
"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "./ui/dialog";
import { usePremiumModal } from "../hooks/use-premium-modal";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { toast } from "sonner";

export const PremiumModal = () => {
  const premiumModal = usePremiumModal();
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const onSubscribe = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/stripe", {
        withCredentials: true, // Ensure cookies are sent
      });
      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error("Missing checkout URL");
      }
    } catch {
      toast("Something went wrong.", { description: "Please try again." });
    } finally {
      setLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <Dialog
      open={premiumModal.isOpen}
      onOpenChange={(open) => { if (!open) premiumModal.onClose(); }}
    >
      <DialogContent>
        <DialogHeader className="space-y-4">
          <DialogTitle className="text-center">Upgrade to Premium</DialogTitle>
          <DialogDescription className="text-center space-y-2">
            Create <span className="text-sky-500 mx-1 font-medium">Custom AI</span> Companions
          </DialogDescription>
          <Separator />
          <div className="flex justify-between">
            <p className="text-2xl font-medium">
              $19<span className="text-sm font-normal">.99 / month</span>
            </p>
            <Button
              disabled={loading}
              onClick={onSubscribe}
              variant="premium"
            >
              Subscribe
            </Button>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};