import { AuthConfigSection } from "@/components/settings/auth-config-section";
import { OpenAIRuntimeSection } from "@/components/settings/openai-runtime-section";
import { PermissionsSection } from "@/components/settings/permissions-section";
import { DataManagementSection } from "@/components/settings/data-management-section";
import { BudgetGuardrailsSection } from "@/components/settings/budget-guardrails-section";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="gradient-sunset-glow min-h-screen">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your Stagent configuration
          </p>
        </div>
        <AuthConfigSection />
        <OpenAIRuntimeSection />
        <BudgetGuardrailsSection />
        <PermissionsSection />
        <DataManagementSection />
      </div>
    </div>
  );
}
