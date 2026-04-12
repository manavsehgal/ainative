"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UninstallConfirmationDialog } from "./uninstall-confirmation-dialog";

interface AppUninstallButtonProps {
  appId: string;
  appName: string;
  variant?: "destructive" | "outline" | "ghost";
  size?: "sm" | "default";
  redirectTo?: string;
}

export function AppUninstallButton({
  appId,
  appName,
  variant = "outline",
  size = "sm",
  redirectTo = "/marketplace",
}: AppUninstallButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);

  async function handleConfirm(deleteProject: boolean) {
    setUninstalling(true);
    try {
      const res = await fetch(`/api/apps/${appId}/uninstall`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteProject }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "Uninstall failed");
      }

      toast.success(
        deleteProject
          ? `${appName} uninstalled and project deleted.`
          : `${appName} uninstalled. Project data was preserved.`,
      );
      setShowConfirm(false);
      router.push(redirectTo);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to uninstall app",
      );
    } finally {
      setUninstalling(false);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setShowConfirm(true)}>
        <Trash2 className="h-4 w-4" />
        Uninstall
      </Button>

      <UninstallConfirmationDialog
        appId={appId}
        appName={appName}
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleConfirm}
        uninstalling={uninstalling}
      />
    </>
  );
}
