import { lookup } from "node:dns/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RECIPE_COVER_MAX_BYTES } from "./r2.server";

const isR2ConfiguredMock = vi.hoisted(() => vi.fn(() => true));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

vi.mock("./r2.server", async () => {
  const actual = await vi.importActual<typeof import("./r2.server")>(
    "./r2.server",
  );

  return {
    ...actual,
    isR2Configured: isR2ConfiguredMock,
  };
});

import { fetchRecipeCover } from "./fetch-recipe-cover.server";

const lookupMock = vi.mocked(lookup);
const fetchMock = vi.fn();
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const coverUrl = "https://images.example.com/cover.jpg";

function mockAddresses(...addresses: string[]) {
  lookupMock.mockResolvedValue(
    addresses.map((address) => ({
      address,
      family: address.includes(":") ? 6 : 4,
    })) as unknown as Awaited<ReturnType<typeof lookup>>,
  );
}

function responseBody(bytes: Uint8Array) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function jpegResponse(
  bytes: Uint8Array = jpegBytes,
  headers: HeadersInit = { "content-type": "image/jpeg" },
) {
  return new Response(responseBody(bytes), { headers, status: 200 });
}

function redirectResponse(location: string) {
  return new Response(null, {
    headers: { location },
    status: 302,
  });
}

describe("fetchRecipeCover", () => {
  afterEach(() => {
    fetchMock.mockReset();
    lookupMock.mockReset();
    isR2ConfiguredMock.mockReset();
    isR2ConfiguredMock.mockReturnValue(true);
    vi.unstubAllGlobals();
  });

  it("downloads a jpeg when the content type matches the bytes", async () => {
    vi.stubGlobal("fetch", fetchMock);
    mockAddresses("93.184.216.34");
    fetchMock.mockResolvedValue(
      jpegResponse(jpegBytes, { "content-type": "image/jpeg; charset=binary" }),
    );

    await expect(fetchRecipeCover(coverUrl)).resolves.toEqual({
      bytes: jpegBytes,
      contentType: "image/jpeg",
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), {
      redirect: "manual",
      signal: expect.any(AbortSignal),
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBeInstanceOf(URL);
    expect((fetchMock.mock.calls[0]?.[0] as URL).href).toBe(coverUrl);
  });

  it("rejects an http url before fetching", async () => {
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchRecipeCover("http://images.example.com/cover.jpg"),
    ).resolves.toEqual({
      error: "Coverbildet må lastes ned over https.",
      ok: false,
    });
    expect(lookupMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a url with userinfo before fetching", async () => {
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchRecipeCover("https://user:pass@images.example.com/cover.jpg"),
    ).resolves.toEqual({
      error: "Coverbildet må lastes ned over https.",
      ok: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.20",
    "169.254.169.254",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
  ])("rejects a resolved private address %s", async (address) => {
    vi.stubGlobal("fetch", fetchMock);
    mockAddresses(address);

    await expect(fetchRecipeCover(coverUrl)).resolves.toEqual({
      error: "Coverbildet kunne ikke lastes ned.",
      ok: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects when any resolved address is private", async () => {
    vi.stubGlobal("fetch", fetchMock);
    mockAddresses("93.184.216.34", "10.0.0.1");

    await expect(fetchRecipeCover(coverUrl)).resolves.toEqual({
      error: "Coverbildet kunne ikke lastes ned.",
      ok: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a redirect to a private host", async () => {
    vi.stubGlobal("fetch", fetchMock);
    lookupMock
      .mockResolvedValueOnce([
        { address: "93.184.216.34", family: 4 },
      ] as unknown as Awaited<ReturnType<typeof lookup>>)
      .mockResolvedValueOnce([
        { address: "10.0.0.1", family: 4 },
      ] as unknown as Awaited<ReturnType<typeof lookup>>);
    fetchMock.mockResolvedValue(
      redirectResponse("https://internal.example/cover.jpg"),
    );

    await expect(fetchRecipeCover(coverUrl)).resolves.toEqual({
      error: "Coverbildet kunne ikke lastes ned.",
      ok: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a fourth redirect", async () => {
    vi.stubGlobal("fetch", fetchMock);
    mockAddresses("93.184.216.34");
    fetchMock.mockImplementation(async () =>
      redirectResponse("https://images.example.com/next.jpg"),
    );

    await expect(fetchRecipeCover(coverUrl)).resolves.toEqual({
      error: "Coverbildet kunne ikke lastes ned.",
      ok: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("rejects html labeled as jpeg", async () => {
    vi.stubGlobal("fetch", fetchMock);
    mockAddresses("93.184.216.34");
    fetchMock.mockResolvedValue(
      new Response(responseBody(new TextEncoder().encode("<html></html>")), {
        headers: { "content-type": "image/jpeg" },
        status: 200,
      }),
    );

    await expect(fetchRecipeCover(coverUrl)).resolves.toEqual({
      error: "Coverbildet må være JPEG, PNG eller WebP.",
      ok: false,
    });
  });

  it("rejects a body over 2 MB", async () => {
    vi.stubGlobal("fetch", fetchMock);
    mockAddresses("93.184.216.34");
    const chunk = new Uint8Array(64 * 1024);
    let sent = 0;
    const limit = RECIPE_COVER_MAX_BYTES + 1;
    fetchMock.mockResolvedValue(
      new Response(
        new ReadableStream({
          pull(controller) {
            if (sent >= limit) {
              controller.close();
              return;
            }

            const size = Math.min(chunk.byteLength, limit - sent);
            controller.enqueue(chunk.subarray(0, size));
            sent += size;
          },
        }),
        { headers: { "content-type": "image/jpeg" }, status: 200 },
      ),
    );

    await expect(fetchRecipeCover(coverUrl)).resolves.toEqual({
      error: "Coverbildet kan være maks 2 MB.",
      ok: false,
    });
  });

  it("rejects a failed download", async () => {
    vi.stubGlobal("fetch", fetchMock);
    mockAddresses("93.184.216.34");
    fetchMock.mockRejectedValue(
      new DOMException("The operation was aborted", "TimeoutError"),
    );

    await expect(fetchRecipeCover(coverUrl)).resolves.toEqual({
      error: "Coverbildet kunne ikke lastes ned.",
      ok: false,
    });
  });

  it("rejects before fetching when R2 is not configured", async () => {
    vi.stubGlobal("fetch", fetchMock);
    isR2ConfiguredMock.mockReturnValue(false);

    await expect(fetchRecipeCover(coverUrl)).resolves.toEqual({
      error:
        "Bildeopplasting er ikke konfigurert. Sett Cloudflare R2-miljøvariabler.",
      ok: false,
    });
    expect(lookupMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
