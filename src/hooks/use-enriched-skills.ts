"use client";
import { useEffect, useState } from "react";
import type { EnrichedSkill } from "@/lib/environment/skill-enrichment";

export function useEnrichedSkills(open: boolean): EnrichedSkill[] {
  const [skills, setSkills] = useState<EnrichedSkill[]>([]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch("/api/environment/skills", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setSkills(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [open]);
  return skills;
}
