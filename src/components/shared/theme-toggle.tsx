"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type ResolvedTheme = "light" | "dark";

function resolveThemePreference(): ResolvedTheme {
  const stored = localStorage.getItem("stagent-theme");
  if (stored === "dark" || stored === "light") return stored;
  // Light-first: default to light when no explicit preference stored
  return "light";
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.style.backgroundColor =
    theme === "dark" ? "oklch(0.14 0.02 250)" : "oklch(0.985 0.004 250)";
  localStorage.setItem("stagent-theme", theme);
  document.cookie = `stagent-theme=${theme};path=/;max-age=31536000;SameSite=Lax`;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const theme = resolveThemePreference();
    applyTheme(theme);
    setDark(theme === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    applyTheme(next ? "dark" : "light");
    setDark(next);
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
