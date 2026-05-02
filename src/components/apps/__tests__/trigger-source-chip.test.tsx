import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TriggerSourceChip } from "../trigger-source-chip";
import type { TriggerSource } from "@/lib/apps/view-kits/types";

describe("TriggerSourceChip", () => {
  it("renders row-insert label with table id", () => {
    const trigger: TriggerSource = {
      kind: "row-insert",
      table: "customer-touchpoints",
      blueprintId: "draft",
    };
    render(<TriggerSourceChip trigger={trigger} />);
    expect(
      screen.getByText(/triggered by row insert in customer-touchpoints/i)
    ).toBeInTheDocument();
  });

  it("renders schedule label", () => {
    const trigger: TriggerSource = {
      kind: "schedule",
      scheduleId: "s1",
      blueprintId: "weekly",
    };
    render(<TriggerSourceChip trigger={trigger} />);
    expect(screen.getByText(/scheduled/i)).toBeInTheDocument();
  });

  it("renders manual label", () => {
    const trigger: TriggerSource = { kind: "manual", blueprintId: "bp" };
    render(<TriggerSourceChip trigger={trigger} />);
    expect(screen.getByText(/manual/i)).toBeInTheDocument();
  });
});
