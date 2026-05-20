import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireFamilyAdminMock, requireUserMock, runNotionImportMock, validateNotionPayloadMock } =
  vi.hoisted(() => {
    return {
      requireFamilyAdminMock: vi.fn(),
      requireUserMock: vi.fn(),
      runNotionImportMock: vi.fn(),
      validateNotionPayloadMock: vi.fn(),
    };
  });

vi.mock("../lib/auth.server", () => {
  return {
    requireUser: requireUserMock,
  };
});

vi.mock("../lib/family.server", () => {
  return {
    requireFamilyAdmin: requireFamilyAdminMock,
  };
});

vi.mock("../lib/notion-import.server", () => {
  return {
    runNotionImport: runNotionImportMock,
    validateNotionPayload: validateNotionPayloadMock,
  };
});

import { action } from "./family-recipe-import";

describe("family-recipe-import route action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: "user-1" });
    requireFamilyAdminMock.mockResolvedValue({
      family: {
        id: "family-1",
        name: "Testfamilie",
      },
      role: "ADMIN",
    });
    validateNotionPayloadMock.mockResolvedValue({
      categories: { created: 1, errors: [], skipped: 0, updated: 0 },
      ingredients: { created: 1, errors: [], skipped: 0, updated: 0 },
      mode: "DRY_RUN",
      recipes: { created: 1, errors: [], skipped: 0, updated: 0 },
    });
    runNotionImportMock.mockResolvedValue({
      categories: { created: 1, errors: [], skipped: 0, updated: 0 },
      ingredients: { created: 1, errors: [], skipped: 0, updated: 0 },
      mode: "APPLY",
      recipes: { created: 1, errors: [], skipped: 0, updated: 0 },
    });
  });

  it("runs dry-run validation when dry-run intent is posted", async () => {
    const request = buildRequest("dry-run-import");

    const response = await action({
      params: { familyId: "family-1" },
      request,
    });

    expect(requireFamilyAdminMock).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(validateNotionPayloadMock).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({
      intent: "dry-run-import",
      summary: expect.objectContaining({
        mode: "DRY_RUN",
      }),
    });
  });

  it("runs import for run-import intent with family/user context", async () => {
    const request = buildRequest("run-import");

    const response = await action({
      params: { familyId: "family-1" },
      request,
    });

    expect(runNotionImportMock).toHaveBeenCalledWith({
      dryRun: false,
      familyId: "family-1",
      userId: "user-1",
    });
    expect(response).toMatchObject({
      intent: "run-import",
      summary: expect.objectContaining({
        mode: "APPLY",
      }),
    });
  });
});

function buildRequest(intent: string) {
  const formData = new FormData();
  formData.set("intent", intent);

  return new Request("http://localhost/families/family-1/recipes/import", {
    body: formData,
    method: "POST",
  });
}
