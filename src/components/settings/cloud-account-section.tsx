"use client";

import { useState, useEffect } from "react";
import { User, LogOut, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";

/**
 * Cloud Account section — sign-in with email for cloud features.
 * Shows sign-in form when not authenticated, account info when signed in.
 * Placed in Settings between Subscription and Cloud Sync.
 */
export function CloudAccountSection() {
  const { isSignedIn, email, loading, signInWithEmail, signOut } = useSupabaseAuth();
  const [inputEmail, setInputEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!inputEmail.includes("@")) return;

    setSending(true);
    const { error } = await signInWithEmail(inputEmail);
    setSending(false);

    if (error) {
      toast.error(error);
    } else {
      setSent(true);
      toast.success("Magic link sent — check your email");
    }
  }

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
  }

  // Handle auth callback URL params — must be in useEffect, not during render
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get("auth");
    if (!authParam || loading) return;

    if (authParam === "success") {
      toast.success("Signed in successfully");
    } else if (authParam === "error") {
      toast.error("Sign-in failed — try again");
    }

    // Clean up URL
    const url = new URL(window.location.href);
    url.searchParams.delete("auth");
    window.history.replaceState({}, "", url.toString());
  }, [loading]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Cloud Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-8 bg-muted rounded w-1/3" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Cloud Account
        </CardTitle>
        <CardDescription>
          {isSignedIn
            ? "Connected to Stagent cloud for sync and billing"
            : "Sign in to enable cloud sync and license activation"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isSignedIn ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-status-completed" />
                Connected
              </Badge>
              <span className="text-sm text-muted-foreground">{email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              Sign out
            </Button>
          </div>
        ) : sent ? (
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Check your email</p>
              <p className="text-xs text-muted-foreground">
                Click the magic link sent to <strong>{inputEmail}</strong> to sign in.
                After clicking, you&apos;ll be redirected back here.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSignIn} className="space-y-3">
            <p className="text-xs text-muted-foreground">
              We&apos;ll send a magic link to your email — no password needed.
              Use your email to enable cloud sync.
            </p>
            <div className="flex gap-2 max-w-md">
              <Input
                type="email"
                placeholder="you@example.com"
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                className="text-sm"
                required
              />
              <Button size="sm" type="submit" disabled={sending}>
                {sending ? "Sending..." : "Sign in"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
