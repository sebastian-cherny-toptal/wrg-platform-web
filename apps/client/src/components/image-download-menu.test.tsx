import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ImageDownloadMenu } from "./image-download-menu";

vi.mock("html-to-image", () => ({
  toJpeg: vi.fn(),
  toPng: vi.fn(),
  toSvg: vi.fn(),
}));

describe("ImageDownloadMenu", () => {
  it("closes its format options when clicking outside", () => {
    render(
      <ImageDownloadMenu
        name="chart"
        targetRef={createRef<HTMLElement>()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Download Report" }));
    expect(screen.getByRole("menuitem", { name: "Download as PNG" })).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menuitem", { name: "Download as PNG" })).toBeNull();
  });
});
