import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Check if we're in the browser
const isBrowser = typeof window !== "undefined";

// Import browser-only modules conditionally
let LanguageDetector: any;
let Backend: any;

if (isBrowser) {
  LanguageDetector = require("i18next-browser-languagedetector").default;
  Backend = require("i18next-http-backend").default;
}

// Common configuration for both server and client
const commonConfig = {
  fallbackLng: "en",
  lng: "en",
  ns: ["translation"],
  defaultNS: "translation",
  debug: false,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
  returnNull: false,
  returnEmptyString: false,
  keySeparator: false as false, // Use flat keys without nesting
};

// Initialize i18n
if (isBrowser && LanguageDetector && Backend) {
  // Browser configuration with dynamic loading
  i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      ...commonConfig,
      backend: {
        loadPath: "/locales/{{lng}}/{{ns}}.json",
      },
      detection: {
        order: ["localStorage", "cookie", "navigator"],
        caches: ["localStorage", "cookie"],
        lookupLocalStorage: "i18nextLng",
        lookupCookie: "i18nextLng",
      },
    })
    .catch((error) => {
      console.error("Failed to initialize i18n:", error);
    });
} else {
  // Server-side configuration
  i18n
    .use(initReactI18next)
    .init({
      ...commonConfig,
      resources: {}, // Will be loaded by the client
    })
    .catch((error) => {
      console.error("Failed to initialize i18n:", error);
    });
}

export { i18n as default, i18n };
