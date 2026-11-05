import { afterEach, describe, expect, it, vi } from "vitest";

import { shoppingNoteMessages } from "./shopping-note";
import { interpretShoppingNote } from "./shopping-note.server";

const categories = [
  { displayName: "Meieri", id: "cat-dairy" },
  { displayName: "Annet", id: "cat-other" },
];

describe("interpretShoppingNote", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sends the existing categories and returns parsed items", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    items: [
                      {
                        categoryId: "cat-dairy",
                        name: "Melk",
                        quantity: "2 liter",
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await interpretShoppingNote({
      categories,
      note: "2 liter melk",
    });

    const request = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.[1]?.body));

    expect(String(request?.[0])).toContain("gemini-3.6-flash");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema.properties.items.items.properties.categoryId.enum).toEqual([
      "cat-dairy",
      "cat-other",
    ]);
    expect(body.contents[0].parts[0].text).toContain("- cat-dairy: Meieri");
    expect(body.contents[0].parts[0].text).toContain("2 liter melk");
    expect(result).toEqual({
      items: [{ categoryId: "cat-dairy", name: "Melk", quantity: "2 liter" }],
      ok: true,
    });
  });

  it("does not call Gemini for an empty note or when the key is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      interpretShoppingNote({ categories, note: "  " }),
    ).resolves.toEqual({
      error: shoppingNoteMessages.empty,
      ok: false,
    });

    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(
      interpretShoppingNote({ categories, note: "melk" }),
    ).resolves.toEqual({
      error: shoppingNoteMessages.geminiMissing,
      ok: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an error on a failed response without logging the note", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "notat: hemmelig melk",
      }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      interpretShoppingNote({ categories, note: "hemmelig melk" }),
    ).resolves.toEqual({
      error: shoppingNoteMessages.geminiFailed,
      ok: false,
    });
    expect(errorSpy).toHaveBeenCalledWith("Gemini shopping note error:", 503);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("hemmelig melk");
  });
});
