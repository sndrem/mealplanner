import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

import {
  isR2Configured,
  RECIPE_COVER_CONTENT_TYPES,
  RECIPE_COVER_MAX_BYTES,
  type RecipeCoverContentType,
} from "./r2.server";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

const DOWNLOAD_ERROR = "Coverbildet kunne ikke lastes ned.";
const HTTPS_ERROR = "Coverbildet må lastes ned over https.";
const SIZE_ERROR = "Coverbildet kan være maks 2 MB.";
const TYPE_ERROR = "Coverbildet må være JPEG, PNG eller WebP.";
const R2_ERROR =
  "Bildeopplasting er ikke konfigurert. Sett Cloudflare R2-miljøvariabler.";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

const blockedAddresses = new BlockList();
blockedAddresses.addSubnet("0.0.0.0", 8, "ipv4");
blockedAddresses.addSubnet("10.0.0.0", 8, "ipv4");
blockedAddresses.addSubnet("127.0.0.0", 8, "ipv4");
blockedAddresses.addSubnet("169.254.0.0", 16, "ipv4");
blockedAddresses.addSubnet("172.16.0.0", 12, "ipv4");
blockedAddresses.addSubnet("192.168.0.0", 16, "ipv4");
blockedAddresses.addSubnet("224.0.0.0", 4, "ipv4");
blockedAddresses.addAddress("255.255.255.255", "ipv4");
blockedAddresses.addAddress("::", "ipv6");
blockedAddresses.addAddress("::1", "ipv6");
blockedAddresses.addSubnet("fc00::", 7, "ipv6");
blockedAddresses.addSubnet("fe80::", 10, "ipv6");
blockedAddresses.addSubnet("ff00::", 8, "ipv6");

export type FetchRecipeCoverResult =
  | {
      bytes: Uint8Array;
      contentType: RecipeCoverContentType;
      ok: true;
    }
  | { error: string; ok: false };

export async function fetchRecipeCover(
  imageUrl: string,
): Promise<FetchRecipeCoverResult> {
  if (!isR2Configured()) {
    return { error: R2_ERROR, ok: false };
  }

  const parsed = parseHttpsUrl(imageUrl);
  if (!parsed.ok) {
    return parsed;
  }

  let current = parsed.url;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (!(await resolvesToPublicAddresses(current))) {
      return { error: DOWNLOAD_ERROR, ok: false };
    }

    let response: Response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      return { error: DOWNLOAD_ERROR, ok: false };
    }

    if (isRedirectStatus(response.status)) {
      if (redirectCount === MAX_REDIRECTS) {
        return { error: DOWNLOAD_ERROR, ok: false };
      }

      const next = nextHttpsUrl(response.headers.get("location"), current);
      if (!next.ok) {
        return { error: DOWNLOAD_ERROR, ok: false };
      }

      current = next.url;
      continue;
    }

    if (!response.ok) {
      return { error: DOWNLOAD_ERROR, ok: false };
    }

    return readCoverBody(response);
  }

  return { error: DOWNLOAD_ERROR, ok: false };
}

function parseHttpsUrl(
  value: string,
): { ok: true; url: URL } | { error: string; ok: false } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { error: HTTPS_ERROR, ok: false };
  }

  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) {
    return { error: HTTPS_ERROR, ok: false };
  }

  return { ok: true, url };
}

function nextHttpsUrl(
  location: string | null,
  current: URL,
): { ok: true; url: URL } | { ok: false } {
  if (!location) {
    return { ok: false };
  }

  let url: URL;
  try {
    url = new URL(location, current);
  } catch {
    return { ok: false };
  }

  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) {
    return { ok: false };
  }

  return { ok: true, url };
}

async function resolvesToPublicAddresses(url: URL) {
  let records: Array<{ address: string }>;

  try {
    records = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    return false;
  }

  return (
    records.length > 0 &&
    records.every((record) => !isBlockedAddress(record.address))
  );
}

function isBlockedAddress(address: string) {
  const normalized = address.trim().toLowerCase();
  const embedded = embeddedIpv4(normalized);

  if (embedded) {
    return blockedAddresses.check(embedded, "ipv4");
  }

  if (normalized.startsWith("::ffff:")) {
    return true;
  }

  const kind = isIP(normalized);
  if (kind === 4) {
    return blockedAddresses.check(normalized, "ipv4");
  }

  if (kind === 6) {
    return blockedAddresses.check(normalized, "ipv6");
  }

  return true;
}

function embeddedIpv4(address: string) {
  const dotted = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (dotted?.[1] && isIP(dotted[1]) === 4) {
    return dotted[1];
  }

  const hex = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!hex?.[1] || !hex[2]) {
    return null;
  }

  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

function isRedirectStatus(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function readCoverBody(
  response: Response,
): Promise<FetchRecipeCoverResult> {
  const contentType = parseCoverContentType(response.headers.get("content-type"));
  if (!contentType) {
    return { error: TYPE_ERROR, ok: false };
  }

  const body = await readLimitedBody(response);
  if (!body.ok) {
    return body;
  }

  if (!magicMatches(body.bytes, contentType)) {
    return { error: TYPE_ERROR, ok: false };
  }

  return { bytes: body.bytes, contentType, ok: true };
}

function parseCoverContentType(header: string | null) {
  const mediaType = header?.split(";")[0]?.trim().toLowerCase() ?? "";

  if ((RECIPE_COVER_CONTENT_TYPES as readonly string[]).includes(mediaType)) {
    return mediaType as RecipeCoverContentType;
  }

  return null;
}

async function readLimitedBody(
  response: Response,
): Promise<{ bytes: Uint8Array; ok: true } | { error: string; ok: false }> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > RECIPE_COVER_MAX_BYTES) {
    return { error: SIZE_ERROR, ok: false };
  }

  if (!response.body) {
    return { error: DOWNLOAD_ERROR, ok: false };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      total += value.byteLength;
      if (total > RECIPE_COVER_MAX_BYTES) {
        await reader.cancel();
        return { error: SIZE_ERROR, ok: false };
      }

      chunks.push(value);
    }
  } catch {
    return { error: DOWNLOAD_ERROR, ok: false };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { bytes, ok: true };
}

function magicMatches(bytes: Uint8Array, contentType: RecipeCoverContentType) {
  if (contentType === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  if (contentType === "image/png") {
    return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
  }

  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}
