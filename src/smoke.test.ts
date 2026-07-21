import { describe, it, expect } from "vitest";
import { cn } from "@/presentation/components/ui/utils";

describe("smoke", () => {
  it("runs the test runner", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves the @/* path alias and runs the cn utility", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", false && "hidden", "font-bold")).toBe("text-sm font-bold");
  });
});
