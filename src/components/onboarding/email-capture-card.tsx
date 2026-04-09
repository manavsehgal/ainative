"use client";

import { useEffect, useState } from "react";
import { Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const DISMISSED_KEY = "onboarding-email-dismissed";

/**
 * Non-blocking email capture card for first-run users.
 * Appears once, never again after submit or dismiss.
 *
 * Hydration note: server cannot read localStorage, so first render always
 * returns null on both server and client. A post-mount effect checks
 * localStorage and reveals the card only if the user hasn't dismissed it.
 * This avoids a hydration mismatch where the server renders the next sibling
 * (WelcomeLanding) at a position the client then replaces with the Card.
 */
export function EmailCaptureCard() {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useEffect(() => {
    setMounted(true);
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "true");
    } catch {
      setDismissed(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/onboarding/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("success");
        localStorage.setItem(DISMISSED_KEY, "true");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (!mounted || dismissed) return null;

  if (status === "success") {
    return (
      <Card className="border-primary/20">
        <CardContent className="py-4 text-center">
          <p className="text-sm text-muted-foreground">
            Check your email for a magic link to connect your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-2 flex-1">
              <p className="text-sm font-medium">Connect your email for cloud features</p>
              <p className="text-xs text-muted-foreground">
                Enable cloud sync, billing, and marketplace access. No account required to use Stagent.
              </p>
              <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-sm"
                  required
                />
                <Button size="sm" type="submit" disabled={status === "loading"}>
                  {status === "loading" ? "..." : "Connect"}
                </Button>
              </form>
              {status === "error" && (
                <p className="text-xs text-destructive">Something went wrong. Try again later.</p>
              )}
            </div>
          </div>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
