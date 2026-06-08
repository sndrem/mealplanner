import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>(
    "../lib/auth.server",
  );

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/kassalapp-integration.server", () => ({
  getFamilyKassalappIntegrationData: vi.fn(),
}));

vi.mock("../lib/kassalapp-integration-write.server", () => ({
  removeFamilyKassalappApiToken: vi.fn(),
  saveFamilyKassalappApiToken: vi.fn(),
}));

import { requireUser } from "../lib/auth.server";
import { getFamilyKassalappIntegrationData } from "../lib/kassalapp-integration.server";
import {
  removeFamilyKassalappApiToken,
  saveFamilyKassalappApiToken,
} from "../lib/kassalapp-integration-write.server";
import { action, loader } from "./family-kassalapp";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(
  url = "http://localhost/families/family-1/kassalapp",
  formData?: FormData,
) {
  return new Request(url, {
    body: formData,
    method: formData ? "POST" : "GET",
  });
}

describe("family kassalapp route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads integration status for family members", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getFamilyKassalappIntegrationData).mockResolvedValue({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      integration: {
        isConfigured: true,
        tokenLastFour: "abcd",
        updatedAt: "2026-06-08T08:00:00.000Z",
      },
      userRole: "ADMIN",
    });

    const result = await loader({
      params: { familyId: "family-1" },
      request: buildRequest(),
    });

    expect(getFamilyKassalappIntegrationData).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(result.integration.isConfigured).toBe(true);
    expect(result.userRole).toBe("ADMIN");
  });

  it("saves api tokens for admins", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(saveFamilyKassalappApiToken).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "save-token");
    formData.set("apiToken", "secret-token");

    const response = await action({
      params: { familyId: "family-1" },
      request: buildRequest(undefined, formData),
    });

    expect(saveFamilyKassalappApiToken).toHaveBeenCalledWith({
      apiToken: "secret-token",
      familyId: "family-1",
      userId: "user-1",
    });
    expect(response).toEqual(
      Response.redirect(
        "http://localhost/families/family-1/kassalapp?notice=token-saved",
        302,
      ),
    );
  });

  it("removes stored api tokens for admins", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(removeFamilyKassalappApiToken).mockResolvedValue({
      status: "REMOVED",
    });

    const formData = new FormData();
    formData.set("intent", "remove-token");

    const response = await action({
      params: { familyId: "family-1" },
      request: buildRequest(undefined, formData),
    });

    expect(removeFamilyKassalappApiToken).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(response).toEqual(
      Response.redirect(
        "http://localhost/families/family-1/kassalapp?notice=token-removed",
        302,
      ),
    );
  });
});
