import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shield, Zap, Wallet } from "lucide-react";

const pillars = [
  {
    icon: Shield,
    title: "Your Rules, Enforced",
    description: "Every agent action respects your policies. Full audit trail for every decision.",
  },
  {
    icon: Zap,
    title: "Business on Autopilot",
    description: "Build workflow templates once, run them many times. 21 specialist profiles ready to deploy.",
  },
  {
    icon: Wallet,
    title: "Know What You Spend",
    description: "Track spend per task, per provider. Budget guardrails prevent surprise bills.",
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
        Welcome to ainative
      </h1>
      <p className="text-base text-muted-foreground mb-8 max-w-lg">
        Your AI Business Operating System. Deploy AI agents, automate business processes, and maintain full control of spend and execution.
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
