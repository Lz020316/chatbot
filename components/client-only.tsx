"use client";

import { type ReactNode, useEffect, useState } from "react";

/**
 * ClientOnly component that prevents hydration mismatches
 * Only renders children after client-side mount
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
