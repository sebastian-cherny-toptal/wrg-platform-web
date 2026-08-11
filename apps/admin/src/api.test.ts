import { describe, expect, it } from "vitest";
import { field, formatDate } from "./api";

describe("admin API projections", () => {
  it("reads the first available compatibility field", () => {
    expect(field({ Account_Name: "Demo Organization" }, "name", "Account_Name")).toBe(
      "Demo Organization",
    );
  });

  it("renders missing dates safely", () => {
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });
});
