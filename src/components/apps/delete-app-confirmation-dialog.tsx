"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface DeleteAppConfirmationDialogProps {
  appId: string;
  appName: string;
  /** Whether the app is currently installed (shows project deletion option). */
  isInstalled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (deleteProject: boolean) => void;
  deleting: boolean;
}

export function DeleteAppConfirmationDialog({
  appName,
  isInstalled,
  open,
  onOpenChange,
  onConfirm,
  deleting,
}: DeleteAppConfirmationDialogProps) {
  const [deleteProject, setDeleteProject] = useState(false);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setDeleteProject(false);
        onOpenChange(o);
      }}
    >
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete {appName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the app package from your device.
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          {isInstalled && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm text-muted-foreground">
                This app is currently installed. It will be uninstalled first.
              </p>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="delete-project-too"
                  checked={deleteProject}
                  onCheckedChange={(checked) =>
                    setDeleteProject(checked === true)
                  }
                />
                <Label
                  htmlFor="delete-project-too"
                  className="text-sm leading-tight cursor-pointer"
                >
                  Also delete the linked project and all its data
                </Label>
              </div>
              {deleteProject && (
                <p className="text-xs text-destructive ml-6">
                  All project data (tables, schedules, workflows) will be
                  permanently deleted.
                </p>
              )}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => onConfirm(deleteProject)}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Permanently"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
