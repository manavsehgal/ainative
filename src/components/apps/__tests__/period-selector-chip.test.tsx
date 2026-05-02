import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PeriodSelectorChip } from "../period-selector-chip";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/apps/finance-pack",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => replaceMock.mockReset());

describe("PeriodSelectorChip", () => {
  it("renders 3 chips: MTD, QTD, YTD", () => {
    render(<PeriodSelectorChip current="mtd" />);
    expect(screen.getByText("MTD")).toBeInTheDocument();
    expect(screen.getByText("QTD")).toBeInTheDocument();
    expect(screen.getByText("YTD")).toBeInTheDocument();
  });

  it("marks the current period as selected via data-selected", () => {
    render(<PeriodSelectorChip current="qtd" />);
    expect(screen.getByText("QTD").closest("button")).toHaveAttribute("data-selected", "true");
  });

  it("calls router.replace with new period on click", () => {
    render(<PeriodSelectorChip current="mtd" />);
    fireEvent.click(screen.getByText("YTD"));
    expect(replaceMock).toHaveBeenCalledWith("/apps/finance-pack?period=ytd");
  });
});
