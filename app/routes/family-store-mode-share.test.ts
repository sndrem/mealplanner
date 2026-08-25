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

vi.mock("../lib/shopping-share.server", () => ({
  createShoppingListShare: vi.fn(),
  getShoppingShareCurationData: vi.fn(),
}));

import { requireUser } from "../lib/auth.server";
import {
  createShoppingListShare,
  getShoppingShareCurationData,
} from "../lib/shopping-share.server";
import { action, loader } from "./family-store-mode-share";

const mockUser = {
  displayName: "Ola",
  email: "ola@example.com",
  id: "user-1",
  isGlobalAdmin: false,
};

const curation = {
  alreadyCheckedItems: [
    {
      category: { id: "cat-dairy", name: "Meieri" },
      checked: true,
      name: "Melk",
      note: null,
      quantityLabel: "1 l",
      sourceKey: "family-milk",
      sourceType: "FAMILY" as const,
    },
  ],
  family: { id: "family-1", name: "Solberg" },
  pendingItems: [
    {
      category: { id: "cat-produce", name: "Frukt og grønt" },
      checked: false,
      name: "Paprika",
      note: null,
      quantityLabel: "1 stk",
      sourceKey: "entry-1:ingredient-1",
      sourceType: "GENERATED" as const,
    },
  ],
};

describe("family store mode share route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads pending items selected by default and checked items separately", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(getShoppingShareCurationData).mockResolvedValue(curation);

    const result = await loader({
      params: { familyId: "family-1" },
      request: new Request("http://localhost/families/family-1/store-mode/share"),
    } as never);

    expect(result.pendingItems).toHaveLength(1);
    expect(result.alreadyCheckedItems[0]?.checked).toBe(true);
  });

  it("creates a share and returns an absolute guest URL", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(createShoppingListShare).mockResolvedValue({
      status: "OK",
      token: "share-token",
    });

    const formData = new FormData();
    formData.append("item", "GENERATED:entry-1:ingredient-1");

    const result = await action({
      params: { familyId: "family-1" },
      request: new Request(
        "http://localhost/families/family-1/store-mode/share",
        { body: formData, method: "POST" },
      ),
    } as never);

    expect(createShoppingListShare).toHaveBeenCalledWith({
      familyId: "family-1",
      selectedKeys: ["GENERATED:entry-1:ingredient-1"],
      userId: "user-1",
    });
    expect(result).toEqual({
      shareUrl: "http://localhost/s/share-token",
    });
  });

  it("returns a validation error when creation is rejected", async () => {
    vi.mocked(requireUser).mockResolvedValue(mockUser);
    vi.mocked(createShoppingListShare).mockResolvedValue({
      formError: "Velg minst én vare å dele.",
      status: "VALIDATION_ERROR",
    });

    const result = await action({
      params: { familyId: "family-1" },
      request: new Request(
        "http://localhost/families/family-1/store-mode/share",
        { body: new FormData(), method: "POST" },
      ),
    } as never);

    expect(result).toEqual({
      formError: "Velg minst én vare å dele.",
    });
  });
});
