"use client";

import { useEffect, useState } from "react";
import { useTranslation as useI18nTranslation } from "react-i18next";

/**
 * Translation hook that prevents hydration mismatches
 * Returns empty strings until client-side mount is complete
 */
export function useTranslationSafe(ns: string | string[] = "translation") {
  const translation = useI18nTranslation(ns);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Safe translation function that prevents hydration issues
  const t = (key: string, options?: any): string => {
    // Return empty string during SSR to match initial client render
    if (!mounted) {
      return "";
    }
    return translation.t(key, options) as string;
  };

  return {
    t,
    i18n: translation.i18n,
    ready: translation.ready && mounted,
    mounted,
  };
}

// Re-export for convenience
export { useTranslationSafe as useTranslation };
