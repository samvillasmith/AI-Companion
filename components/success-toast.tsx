"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export const SuccessToast = () => {
  const router = useRouter();

  useEffect(() => {
    // Show success message
    toast.success("Payment successful! Welcome to Premium!", {
      duration: 5000,
    });

    // Clean up URL after showing toast
    const timer = setTimeout(() => {
      router.replace('/');
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  return null;
};