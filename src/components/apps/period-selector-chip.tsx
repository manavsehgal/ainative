"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const PERIODS = ["mtd", "qtd", "ytd"] as const;
export type Period = (typeof PERIODS)[number];

interface PeriodSelectorChipProps {
  current: Period;
}

export function PeriodSelectorChip({ current }: PeriodSelectorChipProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSelect(p: Period) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="inline-flex gap-1 rounded-lg border p-1">
      {PERIODS.map((p) => (
        <Button
          key={p}
          variant={p === current ? "default" : "ghost"}
          size="sm"
          onClick={() => handleSelect(p)}
          data-selected={String(p === current)}
          className="h-7 px-2.5 text-xs uppercase"
        >
          {p.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
