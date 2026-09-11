import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, type ProgramRecord, type ProjectRecord } from "./api";
import { MetadataStep } from "./historical-import";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const emptyProgramFields = {
  createdAt: null,
  organizationCount: 0,
  winnersCount: 0,
  categorySummaries: [],
  latestZohoSync: null,
};

const zohoProject: ProjectRecord = {
  id: "zoho-project-id",
  externalId: "zoho-project-id",
  name: "Indiana",
  createdAt: null,
  programs: [],
};

const importedProgram: ProgramRecord = {
  id: "database-program-id",
  externalId: "zoho-program-id",
  name: "Indiana 2026",
  year: 2026,
  ...emptyProgramFields,
};

async function renderSelectedProgram(
  importedProjects: ProjectRecord[] = [
    {
      id: "database-project-id",
      externalId: "zoho-project-id",
      name: "Indiana",
      createdAt: null,
      programs: [importedProgram],
    },
  ],
) {
  vi.spyOn(api, "zohoPrograms").mockResolvedValue([
    {
      id: "zoho-program-id",
      name: "Indiana 2026",
      year: 2026,
      projectId: "zoho-project-id",
      projectName: "Indiana",
      projectAbbreviation: "IN",
      efsLaunchDate: "2026-01-10",
      efsDeadline: "2026-02-10",
      winnerOrganizations: [],
      organizations: [],
      categoryPricing: [],
    },
  ]);
  vi.spyOn(api, "projects").mockResolvedValue(importedProjects);
  const onSaved = vi.fn();
  const rendered = render(
    <MemoryRouter initialEntries={["/admin/projects/import"]}>
      <Routes>
        <Route
          path="/admin/projects/import"
          element={
            <MetadataStep
              draft={{}}
              projects={[zohoProject]}
              editing={false}
              onSaved={onSaved}
            />
          }
        />
        <Route
          path="/admin/projects/:projectId/programs/:programId/edit"
          element={<div>Edit program destination</div>}
        />
      </Routes>
    </MemoryRouter>,
  );

  const selects = rendered.container.querySelectorAll("select");
  fireEvent.change(selects[0]!, { target: { value: "zoho-project-id" } });
  await waitFor(() => expect(api.zohoPrograms).toHaveBeenCalled());
  await waitFor(() =>
    expect(rendered.container.querySelectorAll("select").length).toBe(2),
  );
  fireEvent.change(rendered.container.querySelectorAll("select")[1]!, {
    target: { value: "zoho-program-id" },
  });
  fireEvent.click(screen.getAllByRole("button", { name: /Continue/u })[0]!);
  return { onSaved };
}

describe("historical import duplicate program check", () => {
  it("offers the existing program and closes with Cancel or Escape", async () => {
    const { onSaved } = await renderSelectedProgram();
    await screen.findByRole("dialog", { name: "Program already imported" });

    expect(
      screen.getByText(
        "This program was already imported. Do you want to go to its page to see it or edit it?",
      ),
    ).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: /Continue/u })[0]!);
    await screen.findByRole("dialog", { name: "Program already imported" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the existing program edit page when Accept is clicked", async () => {
    await renderSelectedProgram();
    await screen.findByRole("dialog", { name: "Program already imported" });

    const accept = screen.getByRole("link", { name: "Accept" });
    expect(accept.getAttribute("href")).toBe(
      "/admin/projects/database-project-id/programs/database-program-id/edit",
    );
    fireEvent.click(accept);

    expect(await screen.findByText("Edit program destination")).toBeTruthy();
  });

  it("continues when the selected Zoho program has not been imported", async () => {
    const { onSaved } = await renderSelectedProgram([]);

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
