"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import i18n from "../i18n";

function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize language on client side only
    if (typeof window !== "undefined") {
      const savedLanguage = localStorage.getItem("i18nextLng") || "en";
      
      // Wait for i18n to be ready
      if (i18n.isInitialized && i18n.language !== savedLanguage) {
        i18n.changeLanguage(savedLanguage).catch((error) => {
          console.error("Failed to change language:", error);
        });
      }
      
      // Update HTML lang attribute
      document.documentElement.setAttribute("lang", savedLanguage);
    }
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableSystem
      >
        <Toaster position="top-center" />
        <SessionProvider>{children}</SessionProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}

export default Providers;
