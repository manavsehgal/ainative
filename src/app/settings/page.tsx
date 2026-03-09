import { AuthConfigSection } from "@/components/settings/auth-config-section";
import { DataManagementSection } from "@/components/settings/data-management-section";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your Stagent configuration
        </p>
      </div>
      <AuthConfigSection />
      <DataManagementSection />
    </div>
  );
}
