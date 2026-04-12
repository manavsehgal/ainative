"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InstallConfirmationDialog } from "./install-confirmation-dialog";

interface AppDetailInstallButtonProps {
  appId: string;
  appName: string;
}

export function AppDetailInstallButton({ appId, appName }: AppDetailInstallButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [installing, setInstalling] = useState(false);

  async function handleConfirmInstall() {
    setInstalling(true);
    try {
      const res = await fetch("/api/apps/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "Install failed");
      }

      toast.success(`${appName} installed successfully!`);
      setShowConfirm(false);
      router.push(`/apps/${appId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to install app");
    } finally {
      setInstalling(false);
    }
  }

  return (
    <>
      <Button size="lg" onClick={() => setShowConfirm(true)}>
        <Download className="h-4 w-4" />
        Install App
      </Button>

      <InstallConfirmationDialog
        appId={appId}
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleConfirmInstall}
        installing={installing}
      />
    </>
  );
}
