import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shield, GitBranch, Wallet } from "lucide-react";

const pillars = [
  {
    icon: Shield,
    title: "Governed Execution",
    description: "Every agent action requires explicit approval. Full audit trail for every decision.",
  },
  {
    icon: GitBranch,
    title: "Reusable Automation",
    description: "Build workflow templates once, run them many times. Profile-aware agent routing.",
  },
  {
    icon: Wallet,
    title: "Cost & Visibility",
    description: "Track spend per task, per runtime. Budget guardrails prevent surprise bills.",
  },
];

/**
 * WelcomeLanding — shown on fresh instances with no tasks.
 * Simple hero + 3 pillars + single CTA.
 */
export function WelcomeLanding() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto text-center px-4">
      <h1 className="text-3xl font-bold tracking-tight mb-3">
        Welcome to Stagent
      </h1>
      <p className="text-base text-muted-foreground mb-8 max-w-lg">
        The governed AI agent operations workspace. Execute tasks, manage workflows, and maintain full oversight of your AI agents.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-8">
        {pillars.map((pillar) => (
          <div
            key={pillar.title}
            className="surface-card-muted rounded-lg p-4 text-left"
          >
            <pillar.icon className="h-5 w-5 text-primary mb-2" />
            <h3 className="text-sm font-semibold mb-1">{pillar.title}</h3>
            <p className="text-xs text-muted-foreground">
              {pillar.description}
            </p>
          </div>
        ))}
      </div>

      <Link href="/tasks/new">
        <Button size="lg">Create your first task</Button>
      </Link>
    </div>
  );
}
