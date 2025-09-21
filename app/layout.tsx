// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "../components/ui/sonner";
import { PremiumModal } from "../components/premium-modal";
import { ThemeProvider } from "../components/theme-provider";
import FirstSignInGate from "@/components/first-gate";
import { StripeReturnHandler } from "@/components/stripe-return-handler";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const AFTER_SIGN_IN = process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || "/";
const AFTER_SIGN_UP = process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || "/first-run";
const SIGN_IN_URL = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/sign-in";
const SIGN_UP_URL = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "/sign-up";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl={SIGN_IN_URL}
      signUpUrl={SIGN_UP_URL}
      afterSignInUrl={AFTER_SIGN_IN}
      afterSignUpUrl={AFTER_SIGN_UP}
    >
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
        <body className="antialiased">
          <ThemeProvider defaultTheme="system" enableSystem disableTransitionOnChange>
            <StripeReturnHandler />
            <PremiumModal />
            <FirstSignInGate />
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
