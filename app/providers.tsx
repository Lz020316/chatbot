"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import i18n from "../i18n";

function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedLanguage = localStorage.getItem("i18nextLng") || "en";

    const applyLanguage = (languageCode: string) => {
      // Update document metadata first to keep SSR and CSR aligned.
      document.documentElement.setAttribute("lang", languageCode);

      if (i18n.language === languageCode) {
        return;
      }

      i18n.changeLanguage(languageCode).catch((error) => {
        console.error("Failed to change language:", error);
      });
    };

    if (i18n.isInitialized) {
      applyLanguage(savedLanguage);
      return;
    }

    const handleInitialized = () => {
      applyLanguage(savedLanguage);
    };

    // Ensure we react exactly once when i18n finishes bootstrapping.
    i18n.on("initialized", handleInitialized);

    return () => {
      i18n.off("initialized", handleInitialized);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleLanguageChanged = (languageCode: string) => {
      localStorage.setItem("i18nextLng", languageCode);
      document.documentElement.setAttribute("lang", languageCode);
    };

    i18n.on("languageChanged", handleLanguageChanged);

    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
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
