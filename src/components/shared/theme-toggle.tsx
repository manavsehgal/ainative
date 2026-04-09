"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyTheme, readClientTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const theme = readClientTheme();
    applyTheme(theme);
    setDark(theme === "dark");
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    applyTheme(next);
    setDark(next === "dark");
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
