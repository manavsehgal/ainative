"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Map } from "lucide-react";

interface TryItNowProps {
  relatedDocs: string[];
  relatedJourney?: string;
}

/** Doc slug → human-readable title mapping */
const DOC_TITLES: Record<string, { title: string; description: string }> = {
  projects: {
    title: "Projects",
    description: "Create and manage AI-assisted projects",
  },
  "home-workspace": {
    title: "Home Workspace",
    description: "Your central dashboard for all activity",
  },
  "dashboard-kanban": {
    title: "Dashboard & Kanban",
    description: "Visual task boards and project overview",
  },
  "agent-intelligence": {
    title: "Agent Intelligence",
    description: "How agents reason, plan, and execute",
  },
  profiles: {
    title: "Agent Profiles",
    description: "Specialized agent configurations and capabilities",
  },
  monitoring: {
    title: "Monitoring",
    description: "Real-time agent execution logs and metrics",
  },
  documents: {
    title: "Document Manager",
    description: "Upload, process, and manage documents",
  },
  "shared-components": {
    title: "Shared Components",
    description: "Reusable UI components and design patterns",
  },
  workflows: {
    title: "Workflow Engine",
    description: "Multi-step orchestration and adaptive pipelines",
  },
  schedules: {
    title: "Scheduled Intelligence",
    description: "Recurring automation loops and cron-based tasks",
  },
  "inbox-notifications": {
    title: "Inbox & Notifications",
    description: "Permission requests and agent escalations",
  },
  "tool-permissions": {
    title: "Tool Permissions",
    description: "Manage agent access to tools and actions",
  },
  settings: {
    title: "Settings",
    description: "Configure authentication, providers, and preferences",
  },
  chat: {
    title: "Chat",
    description: "Conversational interface with AI agents",
  },
  "cost-usage": {
    title: "Cost & Usage",
    description: "Track API consumption and token budgets",
  },
  "provider-runtimes": {
    title: "Provider Runtimes",
    description: "Configure AI provider connections",
  },
  "design-system": {
    title: "Design System",
    description: "Calm Ops visual language and component tokens",
  },
  "keyboard-navigation": {
    title: "Keyboard Navigation",
    description: "Shortcuts and accessibility patterns",
  },
  playbook: {
    title: "Playbook",
    description: "Feature documentation and learning journeys",
  },
};

const JOURNEY_TITLES: Record<string, { title: string; description: string }> = {
  "personal-use": {
    title: "Personal Use Journey",
    description: "From first project to daily AI-assisted workflows",
  },
  "work-use": {
    title: "Work Use Journey",
    description: "Team collaboration and delegated task execution",
  },
  "power-user": {
    title: "Power User Journey",
    description: "Advanced workflows, scheduling, and multi-agent patterns",
  },
  developer: {
    title: "Developer Journey",
    description: "Architecture deep-dives, customization, and extension",
  },
};

export function TryItNow({ relatedDocs, relatedJourney }: TryItNowProps) {
  if (relatedDocs.length === 0 && !relatedJourney) return null;

  return (
    <section className="mt-10 pt-8 border-t border-border/60" id="try-it-now">
      <h3 className="text-lg font-semibold tracking-tight mb-4 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary/70" />
        Try It Now
      </h3>
      <p className="text-sm text-muted-foreground mb-5">
        Put these concepts into practice with the Playbook guides.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {relatedDocs.map((slug) => {
          const doc = DOC_TITLES[slug];
          if (!doc) return null;
          return (
            <Link
              key={slug}
              href={`/user-guide/${slug}`}
              className="group flex items-start gap-3 rounded-lg border border-border bg-surface-1 p-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm group-hover:text-primary transition-colors">
                  {doc.title}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {doc.description}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </Link>
          );
        })}
        {relatedJourney && JOURNEY_TITLES[relatedJourney] && (
          <Link
            href={`/user-guide/${relatedJourney}`}
            className="group flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/[0.03] p-4 transition-colors hover:border-primary/50 hover:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2"
          >
            <Map className="h-5 w-5 mt-0.5 shrink-0 text-primary/60" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm group-hover:text-primary transition-colors">
                {JOURNEY_TITLES[relatedJourney].title}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {JOURNEY_TITLES[relatedJourney].description}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </Link>
        )}
      </div>
    </section>
  );
}
