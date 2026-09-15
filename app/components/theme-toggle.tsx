import type { ReactNode } from "react";
import { useFetcher, useRouteLoaderData } from "react-router";

import {
  applyThemeHtmlClass,
  DEFAULT_THEME_PREFERENCE,
  parseThemePreference,
  type ThemePreferenceValue,
} from "../lib/theme-preference";

function SystemIcon() {
  return (
    <svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24">
      <rect
        className="stroke-current"
        height="14"
        rx="2"
        strokeWidth="1.75"
        width="18"
        x="3"
        y="4"
      />
      <path
        className="stroke-current"
        d="M8 20h8"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function LightIcon() {
  return (
    <svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24">
      <circle className="stroke-current" cx="12" cy="12" r="4" strokeWidth="1.75" />
      <path
        className="stroke-current"
        d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.2 6.2 4.8 4.8M19.2 19.2l-1.4-1.4M17.8 6.2l1.4-1.4M6.2 17.8l-1.4 1.4"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function DarkIcon() {
  return (
    <svg aria-hidden className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        className="stroke-current"
        d="M17 13.5A7 7 0 1 1 10.5 7 5.5 5.5 0 0 0 17 13.5Z"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

const THEME_OPTIONS: Array<{
  icon: ReactNode;
  label: string;
  value: ThemePreferenceValue;
}> = [
  {
    icon: <SystemIcon />,
    label: "System",
    value: "SYSTEM",
  },
  {
    icon: <LightIcon />,
    label: "Lyst",
    value: "LIGHT",
  },
  {
    icon: <DarkIcon />,
    label: "Mørkt",
    value: "DARK",
  },
];

export function ThemeToggle({ variant }: { variant: "desktop" | "mobile" }) {
  const rootData = useRouteLoaderData("root") as
    | { themePreference?: ThemePreferenceValue }
    | undefined;
  const fetcher = useFetcher();
  const pendingPreference = parseThemePreference(
    fetcher.formData?.get("themePreference"),
  );
  const selectedPreference =
    pendingPreference ?? rootData?.themePreference ?? DEFAULT_THEME_PREFERENCE;

  return (
    <div
      aria-label="Utseende"
      className={
        variant === "desktop"
          ? "inline-flex rounded-2xl bg-white/10 p-1"
          : "inline-flex w-full rounded-2xl bg-white/10 p-1"
      }
      role="radiogroup"
    >
      {THEME_OPTIONS.map((option) => {
        const checked = selectedPreference === option.value;
        const className =
          variant === "desktop"
            ? [
                "inline-flex size-9 items-center justify-center rounded-xl transition",
                checked
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-200 hover:bg-white/10 hover:text-white",
              ].join(" ")
            : [
                "flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                checked
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-200 hover:bg-white/10 hover:text-white",
              ].join(" ");

        return (
          <fetcher.Form
            action="/theme"
            className={variant === "mobile" ? "flex-1" : undefined}
            key={option.value}
            method="post"
          >
            <input name="themePreference" type="hidden" value={option.value} />
            <button
              aria-checked={checked}
              aria-label={option.label}
              className={className}
              onClick={() => {
                applyThemeHtmlClass(option.value);
              }}
              role="radio"
              type="submit"
            >
              {variant === "desktop" ? option.icon : option.label}
            </button>
          </fetcher.Form>
        );
      })}
    </div>
  );
}
