import type { KassalappStoreCode } from "./kassalapp.types";

export const DEFAULT_KASSALAPP_STORE_CODES = [
  "KIWI",
  "REMA_1000",
  "MENY_NO",
  "SPAR_NO",
  "BUNNPRIS",
] as const satisfies readonly KassalappStoreCode[];

export const KASSALAPP_STORE_DISPLAY_NAMES: Record<KassalappStoreCode, string> = {
  BUNNPRIS: "Bunnpris",
  KIWI: "Kiwi",
  MENY_NO: "Meny",
  REMA_1000: "Rema 1000",
  SPAR_NO: "Spar",
};

const STORE_KEY_TO_KASSALAPP_CODE: Record<string, KassalappStoreCode> = {
  bunnpris: "BUNNPRIS",
  kiwi: "KIWI",
  meny: "MENY_NO",
  "rema-1000": "REMA_1000",
  rema_1000: "REMA_1000",
  spar: "SPAR_NO",
};

export function resolveKassalappCodeFromStoreKey(
  key: string | null | undefined,
): KassalappStoreCode | null {
  if (!key) {
    return null;
  }

  return STORE_KEY_TO_KASSALAPP_CODE[key.trim().toLowerCase()] ?? null;
}

export function isKassalappStoreCode(value: string): value is KassalappStoreCode {
  return value in KASSALAPP_STORE_DISPLAY_NAMES;
}
