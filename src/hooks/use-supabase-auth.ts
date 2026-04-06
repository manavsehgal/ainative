"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/cloud/supabase-browser";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  session: Session | null;
  user: User | null;
  email: string | null;
  loading: boolean;
}

/**
 * Hook for Supabase Auth state in the browser.
 * Tracks session, provides sign-in/sign-out helpers.
 */
export function useSupabaseAuth() {
  const [auth, setAuth] = useState<AuthState>({
    session: null,
    user: null,
    email: null,
    loading: true,
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuth({
        session,
        user: session?.user ?? null,
        email: session?.user?.email ?? null,
        loading: false,
      });
    });

    // Listen for auth state changes (magic link callback, sign-out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth({
        session,
        user: session?.user ?? null,
        email: session?.user?.email ?? null,
        loading: false,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    const supabase = getSupabaseBrowserClient();
    const redirectTo = typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : "http://localhost:3000/auth/callback";

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  }, []);

  return {
    ...auth,
    isSignedIn: !!auth.session,
    signInWithEmail,
    signOut,
  };
}
