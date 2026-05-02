import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VariableInput } from "../variable-input";
import type { BlueprintVariable } from "@/lib/workflows/blueprints/types";

describe("VariableInput", () => {
  it("renders a text input for type=text", () => {
    const variable: BlueprintVariable = {
      id: "name", type: "text", label: "Name", required: true,
    };
    const { container } = render(
      <VariableInput variable={variable} value="" onChange={() => {}} />
    );
    expect(screen.getByText(/name/i)).toBeInTheDocument();
    const input = container.querySelector('input[type="text"], input:not([type])');
    expect(input).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders a select for type=select with options", () => {
    const variable: BlueprintVariable = {
      id: "horizon",
      type: "select",
      label: "Horizon",
      required: false,
      options: [{ value: "short", label: "Short" }, { value: "long", label: "Long" }],
    };
    render(<VariableInput variable={variable} value="short" onChange={() => {}} />);
    expect(screen.getByText("Horizon")).toBeInTheDocument();
  });

  it("renders a textarea for type=textarea", () => {
    const variable: BlueprintVariable = {
      id: "notes", type: "textarea", label: "Notes", required: false,
    };
    const { container } = render(
      <VariableInput variable={variable} value="" onChange={() => {}} />
    );
    expect(screen.getByText(/notes/i)).toBeInTheDocument();
    expect(container.querySelector("textarea")).toBeInTheDocument();
  });

  it("renders a number input with min/max for type=number", () => {
    const variable: BlueprintVariable = {
      id: "qty", type: "number", label: "Qty", required: false, min: 1, max: 100,
    };
    const { container } = render(
      <VariableInput variable={variable} value={5} onChange={() => {}} />
    );
    expect(screen.getByText(/qty/i)).toBeInTheDocument();
    const input = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe("number");
    expect(input.min).toBe("1");
    expect(input.max).toBe("100");
  });

  it("renders a switch for type=boolean", () => {
    const variable: BlueprintVariable = {
      id: "enabled", type: "boolean", label: "Enabled", required: false,
    };
    render(<VariableInput variable={variable} value={false} onChange={() => {}} />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });
});
