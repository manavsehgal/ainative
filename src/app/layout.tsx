import type { Metadata } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/shared/app-sidebar";
import { CommandPalette } from "@/components/shared/command-palette";
import { PendingApprovalHost } from "@/components/notifications/pending-approval-host";
import { GlobalShortcuts } from "@/components/shared/global-shortcuts";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stagent",
  description: "AI agent task management",
  icons: {
    icon: [
      { url: "/stagent-s-64.png", sizes: "64x64", type: "image/png" },
    ],
    apple: [
      { url: "/stagent-s-128.png", sizes: "128x128", type: "image/png" },
    ],
  },
};

// Inline theme bootstrap prevents a flash between the server render and local theme preference.
// Default is light theme for fresh visits (no localStorage).
const CRITICAL_THEME_CSS = `
  :root {
    color-scheme: light;
    --background: oklch(0.985 0.004 250);
    --foreground: oklch(0.14 0.02 250);
    --surface-1: oklch(1 0 0);
    --surface-2: oklch(0.975 0.004 250);
    --border: oklch(0.90 0.006 250);
  }
  html.dark {
    color-scheme: dark;
    --background: oklch(0.14 0.02 250);
    --foreground: oklch(0.92 0.01 250);
    --surface-1: oklch(0.18 0.02 250);
    --surface-2: oklch(0.16 0.02 250);
    --border: oklch(0.26 0.015 250);
  }
  html { background: var(--background); font-size: 14px; }
`.replace(/\s+/g, " ").trim();

// Light-first: defaults to 'light' when no localStorage preference exists.
// Static theme initialization script — no user input, safe from XSS.
const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var s=localStorage.getItem('stagent-theme');var t=s==='dark'||s==='light'?s:'light';d.classList.toggle('dark',t==='dark');d.dataset.theme=t;d.style.colorScheme=t;d.style.backgroundColor=t==='dark'?'oklch(0.14 0.02 250)':'oklch(0.985 0.004 250)';document.cookie='stagent-theme='+t+';path=/;max-age=31536000;SameSite=Lax';}catch(e){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Static CSS — no user input, safe from XSS */}
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_THEME_CSS }} />
        {/* Theme bootstrap — runs before paint to prevent FOUC */}
        <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT_SCRIPT}</Script>
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <a href="#main-content" className="skip-nav">
          Skip to main content
        </a>
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-w-0">
              <main id="main-content">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
          <PendingApprovalHost />
          <CommandPalette />
          <GlobalShortcuts />
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
