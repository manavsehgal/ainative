import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/shared/app-sidebar";
import { CommandPalette } from "@/components/shared/command-palette";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stagent",
  description: "AI agent task management",
};

// Inline theme bootstrap prevents a flash between the server render and local theme preference.
const CRITICAL_THEME_CSS = `
  :root {
    color-scheme: light;
    --background: oklch(0.98 0.005 260);
    --foreground: oklch(0.15 0.02 260);
    --surface-1: rgba(255, 255, 255, 0.92);
    --surface-2: rgba(255, 255, 255, 0.82);
    --border: oklch(0.82 0.01 260 / 0.2);
  }
  html.dark {
    color-scheme: dark;
    --background: oklch(0.09 0.02 265);
    --foreground: oklch(0.93 0.015 270);
    --surface-1: oklch(0.16 0.02 268 / 0.96);
    --surface-2: oklch(0.14 0.018 272 / 0.9);
    --border: oklch(0.36 0.03 270 / 0.28);
  }
  html { background: var(--background); }
`.replace(/\s+/g, " ").trim();

// Static theme initialization script — no user input, safe from XSS.
const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var s=localStorage.getItem('stagent-theme');var t=s==='dark'||s==='light'?s:(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');d.classList.toggle('dark',t==='dark');d.dataset.theme=t;d.style.colorScheme=t;d.style.backgroundColor=t==='dark'?'oklch(0.09 0.02 265)':'oklch(0.98 0.005 260)';document.cookie='stagent-theme='+t+';path=/;max-age=31536000;SameSite=Lax';}catch(e){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_THEME_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-w-0">
              {children}
            </SidebarInset>
          </SidebarProvider>
          <CommandPalette />
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
