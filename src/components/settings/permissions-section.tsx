"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, X } from "lucide-react";

export function PermissionsSection() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    fetchPermissions();
  }, []);

  async function fetchPermissions() {
    try {
      const res = await fetch("/api/permissions");
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.permissions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(pattern: string) {
    setRevoking(pattern);
    try {
      const res = await fetch("/api/permissions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern }),
      });
      if (res.ok) {
        setPermissions((prev) => prev.filter((p) => p !== pattern));
      }
    } finally {
      setRevoking(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Tool Permissions
        </CardTitle>
        <CardDescription>
          Tools matching these patterns are automatically approved when agents request permission.
          Revoke a pattern to require manual approval again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : permissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No saved permissions. Click &quot;Always Allow&quot; on a tool permission request in the Inbox to add one.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {permissions.map((pattern) => (
              <Badge
                key={pattern}
                variant="secondary"
                className="font-mono text-xs px-3 py-1.5 gap-1.5"
              >
                {pattern}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => handleRevoke(pattern)}
                  disabled={revoking === pattern}
                  aria-label={`Revoke ${pattern}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
