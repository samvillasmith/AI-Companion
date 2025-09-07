// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function absoluteUrl(path: string) {
  // Use the correct environment variable
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.NEXT_PUBLIC_VERCEL_URL 
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` 
      : "http://localhost:3000");
  
  return `${baseUrl}${path}`;
}