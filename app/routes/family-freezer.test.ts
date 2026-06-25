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

vi.mock("../lib/freezer.server", () => {
  return {
    listFamilyFreezerItems: vi.fn(),
  };
});

vi.mock("../lib/freezer-write.server", () => {
  return {
    addFamilyFreezerItem: vi.fn(),
    removeFamilyFreezerItem: vi.fn(),
    updateFamilyFreezerItem: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { listFamilyFreezerItems } from "../lib/freezer.server";
import {
  addFamilyFreezerItem,
  removeFamilyFreezerItem,
  updateFamilyFreezerItem,
} from "../lib/freezer-write.server";
import { action, loader } from "./family-freezer";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(
  url = "http://localhost/families/family-1/freezer",
  formData?: FormData,
) {
  return new Request(url, {
    body: formData,
    method: formData ? "POST" : "GET",
  });
}

describe("family freezer route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads family freezer items", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(listFamilyFreezerItems).mockResolvedValue({
      family: {
        id: "family-1",
        name: "Solberg",
      },
      freezerItems: [
        {
          id: "freezer-1",
          label: "Chili",
          note: "Boks 2",
          quantity: 3,
        },
      ],
      userRole: "MEMBER",
    });

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(),
    });

    expect(result.freezerItems).toHaveLength(1);
    expect(result.userRole).toBe("MEMBER");
  });

  it("adds a freezer item", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(addFamilyFreezerItem).mockResolvedValue({
      freezerItemId: "freezer-1",
      status: "CREATED",
    });

    const formData = new FormData();
    formData.set("intent", "add-freezer-item");
    formData.set("label", "Chili");
    formData.set("quantity", "3");
    formData.set("note", "Boks 2");

    const response = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(
        "http://localhost/families/family-1/freezer",
        formData,
      ),
    });

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect(addFamilyFreezerItem).toHaveBeenCalled();
  });

  it("updates a freezer item", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateFamilyFreezerItem).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "update-freezer-item");
    formData.set("freezerItemId", "freezer-1");
    formData.set("label", "Chili oppdatert");
    formData.set("quantity", "2");
    formData.set("note", "");

    const response = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(
        "http://localhost/families/family-1/freezer",
        formData,
      ),
    });

    expect(response).toBeInstanceOf(Response);
    expect(updateFamilyFreezerItem).toHaveBeenCalledWith({
      familyId: "family-1",
      freezerItemId: "freezer-1",
      userId: "user-1",
      values: {
        label: "Chili oppdatert",
        note: "",
        quantity: "2",
      },
    });
  });

  it("removes a freezer item", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(removeFamilyFreezerItem).mockResolvedValue({
      status: "DELETED",
    });

    const formData = new FormData();
    formData.set("intent", "remove-freezer-item");
    formData.set("freezerItemId", "freezer-1");

    const response = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(
        "http://localhost/families/family-1/freezer",
        formData,
      ),
    });

    expect(response).toBeInstanceOf(Response);
    expect(removeFamilyFreezerItem).toHaveBeenCalledWith({
      familyId: "family-1",
      freezerItemId: "freezer-1",
      userId: "user-1",
    });
  });
});
