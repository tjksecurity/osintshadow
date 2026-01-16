"use client";
import { useEffect, useState } from "react";

// Renders children only on the client to avoid SSR/client markup mismatches
export default function ClientOnly({ children, fallback = null }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return fallback;
  return children;
}
