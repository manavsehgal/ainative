"use client";

import { useEffect, useState } from "react";

/**
 * Hook that returns true when the user prefers reduced motion.
 * Respects the `prefers-reduced-motion` media query.
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);

    function handleChange(event: MediaQueryListEvent) {
      setReducedMotion(event.matches);
    }

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  return reducedMotion;
}
