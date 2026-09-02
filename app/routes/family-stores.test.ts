import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/auth.server", async () => {
  const actual = await vi.importActual<typeof import("../lib/auth.server")>("../lib/auth.server");

  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

vi.mock("../lib/store.server", () => {
  return {
    getStoreManagementData: vi.fn(),
  };
});

vi.mock("../lib/store-write.server", () => {
  return {
    createFamilyStore: vi.fn(),
    deleteFamilyStore: vi.fn(),
    updateFamilyStore: vi.fn(),
  };
});

import { requireUser } from "../lib/auth.server";
import { getStoreManagementData } from "../lib/store.server";
import { createFamilyStore, deleteFamilyStore, updateFamilyStore } from "../lib/store-write.server";
import { action, loader } from "./family-stores";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

function buildRequest(url = "http://localhost/families/family-1/stores", formData?: FormData) {
  return new Request(url, {
    body: formData,
    method: formData ? "POST" : "GET",
  });
}

describe("family stores route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads scoped store management data", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getStoreManagementData).mockResolvedValue({
      categories: [
        {
          displayName: "Frukt og gront",
          familyId: null,
          id: "category-produce",
          key: "produce",
        },
      ],
      family: {
        id: "family-1",
        name: "Solberg",
      },
      familyStores: [
        {
          familyId: "family-1",
          id: "store-1",
          key: null,
          name: "Helgebutikk",
          sections: [
            {
              categoryId: "category-produce",
              displayName: "Gront",
              id: "section-1",
              sortOrder: 1,
            },
          ],
        },
      ],
      globalStores: [],
      userRole: "ADMIN",
    });

    const result = await loader({
      params: {
        familyId: "family-1",
      },
      request: buildRequest(),
    });

    expect(getStoreManagementData).toHaveBeenCalledWith({
      familyId: "family-1",
      userId: "user-1",
    });
    expect(result).toEqual({
      categories: [
        {
          displayName: "Frukt og gront",
          familyId: null,
          id: "category-produce",
          key: "produce",
        },
      ],
      family: {
        id: "family-1",
        name: "Solberg",
      },
      familyStores: [
        {
          familyId: "family-1",
          id: "store-1",
          key: null,
          name: "Helgebutikk",
          sections: [
            {
              categoryId: "category-produce",
              displayName: "Gront",
              id: "section-1",
              sortOrder: 1,
            },
          ],
        },
      ],
      globalStores: [],
      notice: null,
      userRole: "ADMIN",
    });
  });

  it("returns create validation errors from the server module", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(createFamilyStore).mockResolvedValue({
      fieldErrors: {
        name: "Skriv inn et butikknavn.",
      },
      status: "VALIDATION_ERROR",
      values: {
        name: "",
      },
    });

    const formData = new FormData();
    formData.set("intent", "create-store");
    formData.set("name", "   ");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1/stores", formData),
    });

    expect(createFamilyStore).toHaveBeenCalledWith({
      familyId: "family-1",
      name: "   ",
      userId: "user-1",
    });
    expect(result).toEqual({
      createFieldErrors: {
        name: "Skriv inn et butikknavn.",
      },
      createValues: {
        name: "",
      },
      intent: "create-store",
    });
  });

  it("redirects after deleting a store", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(deleteFamilyStore).mockResolvedValue({
      status: "DELETED",
    });

    const formData = new FormData();
    formData.set("intent", "delete-store");
    formData.set("storeId", "store-1");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1/stores", formData),
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe(
      "http://localhost/families/family-1/stores?notice=store-deleted",
    );
  });

  it("submits the full staged section order when updating a store", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(updateFamilyStore).mockResolvedValue({
      status: "UPDATED",
    });

    const formData = new FormData();
    formData.set("intent", "update-store");
    formData.set("storeId", "store-1");
    formData.set("name", "Helgebutikk");
    formData.append("sectionCategoryId", "category-produce");
    formData.append("sectionCategoryId", "category-bakery");
    formData.set("sectionDisplayName:category-produce", "Frukt og gront");
    formData.set("sectionDisplayName:category-bakery", "Brod");

    const result = await action({
      params: {
        familyId: "family-1",
      },
      request: buildRequest("http://localhost/families/family-1/stores", formData),
    });

    expect(updateFamilyStore).toHaveBeenCalledWith({
      familyId: "family-1",
      storeId: "store-1",
      userId: "user-1",
      values: {
        name: "Helgebutikk",
        sections: [
          {
            categoryId: "category-produce",
            displayName: "Frukt og gront",
          },
          {
            categoryId: "category-bakery",
            displayName: "Brod",
          },
        ],
      },
    });
    expect((result as Response).headers.get("Location")).toBe(
      "http://localhost/families/family-1/stores?notice=store-updated",
    );
  });
});
