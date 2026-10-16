import type { ReactNode } from "react";

import {
  resolveShoppingItemIcon,
  type ShoppingItemIconKey,
} from "../lib/shopping-item-icons";

interface ShoppingItemIconProps {
  categoryKey?: string | null;
  checked?: boolean;
  name: string;
  size?: "list" | "store";
}

export function ShoppingItemIcon({
  categoryKey,
  checked = false,
  name,
  size = "store",
}: ShoppingItemIconProps) {
  const icon = resolveShoppingItemIcon({ categoryKey, name });
  const chipClass =
    size === "list" ? "size-10 rounded-[14px]" : "size-9 rounded-xl";
  const iconId =
    icon.kind === "diagram" ? icon.key : `letter:${icon.letter}`;

  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 self-start place-items-center bg-accent-soft text-ink pointer-events-none ${chipClass} ${checked ? "opacity-50" : ""}`}
      data-shopping-item-icon={iconId}
    >
      {icon.kind === "diagram" ? (
        <IconSvg>{iconBody(icon.key)}</IconSvg>
      ) : (
        <LetterSvg letter={icon.letter} />
      )}
    </span>
  );
}

function IconSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      className="size-[70%]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.15}
      viewBox="0 0 48 48"
    >
      {children}
    </svg>
  );
}

function LetterSvg({ letter }: { letter: string }) {
  return (
    <svg className="size-[78%]" viewBox="0 0 48 48">
      <text
        fill="currentColor"
        fontFamily="ui-rounded, system-ui, sans-serif"
        fontSize="28"
        fontWeight="700"
        stroke="none"
        textAnchor="middle"
        x="24"
        y="33"
      >
        {letter}
      </text>
    </svg>
  );
}

function iconBody(key: ShoppingItemIconKey) {
  switch (key) {
    case "apple":
      return (
        <>
          <path d="M24 18c-8 1-13 7-12 15 1 7 6 11 12 11s11-4 12-11c1-8-4-14-12-15z" />
          <path d="M24 18v-6" />
          <path d="M24 14c4-3 8-2 9 1" />
        </>
      );
    case "avocado":
      return (
        <>
          <path d="M24 8c8 2 12 12 10 22-2 8-6 12-10 12s-8-4-10-12C12 20 16 10 24 8z" />
          <circle cx="24" cy="30" r="4.5" />
        </>
      );
    case "banana":
      return (
        <>
          <path d="M18 14.5c7.6-6.4 17.6-2.4 19.6 7.2 2.4 11.4-.6 19.6-6.6 21.6-2.8 1-5-.8-4.4-3.6 1-7-.4-13-3.2-17.2C20.6 18.2 18.6 16 18 14.5z" />
          <path d="M17.2 13.6c-2.8-.4-4.8 1.2-4.2 3.4" />
        </>
      );
    case "bread":
      return (
        <>
          <path d="M8.5 31c0-9 6.6-15.5 15.5-15.5S39.5 22 39.5 31V40h-31V31z" />
          <path d="M8.5 34.5h31" />
          <path d="M16.5 28.5 19.8 20.5" />
          <path d="M24 30 27.2 19.5" />
          <path d="M31.5 28.5 34.8 20.5" />
        </>
      );
    case "broccoli":
      return (
        <>
          <path d="M22 28v12M26 28v12" />
          <circle cx="18" cy="20" r="6" />
          <circle cx="30" cy="20" r="6" />
          <circle cx="24" cy="15" r="6" />
        </>
      );
    case "butter":
      return (
        <>
          <path d="M10 18h28v14H10z" />
          <path d="M10 24h28" />
          <path d="M18 18v-4h12v4" />
        </>
      );
    case "carrot":
      return (
        <>
          <path d="M20.5 17.5c1.4 8 3 16 2.4 22.5 6-6.2 10.6-14.2 11-22.2-4.2 2-9.4 1.8-13.4-.3z" />
          <path d="M22 17.2c-.4-6 2-10.2 6-11.2" />
          <path d="M25.5 15.4c2-6 7-8.2 10.2-5.6" />
          <path d="M22.2 26.5c3.2 1.3 6.4 1 8.6-.4" />
        </>
      );
    case "cheese":
      return (
        <>
          <path d="M11 16.5h11c10.5 1.6 15 7 15 10.6S32.5 36.2 22 38H11V16.5z" />
          <circle cx="20.5" cy="24" r="2.5" />
          <circle cx="28.5" cy="28.2" r="2.15" />
          <circle cx="20" cy="31.6" r="1.9" />
        </>
      );
    case "chicken":
      return (
        <>
          <path d="M10 25c-3.5 1.2-4.5 6-1.2 7.6" />
          <ellipse cx="22" cy="28" rx="12.5" ry="8.4" />
          <path d="M14 26.5c5 3.6 11 3.2 14.5-.8" />
          <circle cx="35.5" cy="17.5" r="5.2" />
          <path d="M40 16.6h5.2" />
          <path d="M33.2 13.6c1.2-3.2 4-3.6 5-.4" />
          <path d="M18 35.2 16.4 42.2" />
          <path d="M13.8 42.2h5.2" />
          <path d="M27 35.8 28.8 43" />
          <path d="M26.2 43h5.4" />
        </>
      );
    case "chocolate":
      return (
        <>
          <path d="M12 14h24v20H12z" />
          <path d="M12 21h24M12 28h24M20 14v20M28 14v20" />
        </>
      );
    case "citrus":
      return (
        <>
          <circle cx="24" cy="26" r="12" />
          <path d="M24 14v24M14 22h20" />
          <path d="M20 12c1.2 2 2.6 3 4 3s2.8-1 4-3" />
        </>
      );
    case "coffee":
      return (
        <>
          <path d="M12 16h20v14a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8V16z" />
          <path d="M32 20h4a4 4 0 0 1 0 8h-4" />
          <path d="M18 10c0 2 2 2 2 4M24 10c0 2 2 2 2 4" />
        </>
      );
    case "corn":
      return (
        <>
          <path d="M24 8c6 2 8 8 8 16s-2 14-8 16c-6-2-8-8-8-16S18 10 24 8z" />
          <path d="M20 16h8M19 22h10M20 28h8M21 34h6" />
          <path d="M24 8c2-3 6-4 8-2" />
        </>
      );
    case "cream":
      return (
        <>
          <path d="M13.5 14h21v4.2h-21z" />
          <path d="M15.5 18.2h17L30.6 33.2a7 7 0 0 1-13.2 0L15.5 18.2z" />
          <path d="M19.5 26.5c2.2-2.6 6.2-2.2 7.4.8 1.2 3-.4 5-3.2 5.2-2.6.2-4.2-1.6-3.4-3.6" />
        </>
      );
    case "cucumber":
      return (
        <>
          <path d="M14 18c8-6 18-4 22 4 4 8 2 16-4 18-8 3-18 0-22-6-3-5-2-12 4-16z" />
          <path d="M18 22c4 2 10 2 14-1" />
        </>
      );
    case "diaper":
      return (
        <>
          <path d="M11 17h26c.6 8-.2 14.5-4.6 18.6C28 39.2 24 41 24 41s-4-1.8-8.4-5.4C11.2 31.5 10.4 25 11 17z" />
          <path d="M11.5 24.5h25" />
          <path d="M24 35.2c-3.2-2.2-5.4-3.8-5.4-5.8 0-1.7 1.3-2.9 2.8-2.9 1.2 0 2 .8 2.6 1.8.6-1 1.4-1.8 2.6-1.8 1.5 0 2.8 1.2 2.8 2.9 0 2-2.2 3.6-5.4 5.8z" />
        </>
      );
    case "egg":
      return (
        <>
          <ellipse cx="17" cy="27.5" rx="8" ry="11.2" />
          <ellipse cx="30.5" cy="25" rx="8.6" ry="12" />
          <path d="M34 18.2c1.5 2.2 1.6 4.2.5 6.2" />
        </>
      );
    case "eggplant":
      return (
        <>
          <path d="M20 16c8-2 16 4 16 14 0 8-5 14-12 14S14 38 14 30c0-8 2-12 6-14z" />
          <path d="M18 16c2-4 6-6 10-4" />
          <path d="M16 14c4 1 8 0 10 2" />
        </>
      );
    case "fish":
      return (
        <>
          <path d="M6.5 26c6.2-8.2 16-10.6 24.2-6.4 3.4 1.7 5.6 4 5.6 6.4s-2.2 4.8-5.6 6.5C22.5 37 12.7 34.4 6.5 26z" />
          <path d="M34.5 26 45 15.5 43 26 45 36.5 34.5 26z" />
          <circle cx="14.5" cy="24.4" r="1.35" fill="currentColor" stroke="none" />
          <path d="M15.5 31.5c5.2 2.6 10.4 1.6 14.2-1" />
        </>
      );
    case "flower":
      return (
        <>
          <circle cx="24" cy="20" r="4" />
          <circle cx="16" cy="24" r="4" />
          <circle cx="32" cy="24" r="4" />
          <circle cx="19" cy="32" r="4" />
          <circle cx="29" cy="32" r="4" />
          <path d="M24 36v8" />
        </>
      );
    case "garlic":
      return (
        <>
          <path d="M24 10c6 4 10 12 8 22-1 6-5 10-8 10s-7-4-8-10c-2-10 2-18 8-22z" />
          <path d="M24 14v24" />
          <path d="M24 10c-2-3 2-5 4-3" />
        </>
      );
    case "ginger":
      return (
        <>
          <path d="M14 28c2-8 8-12 14-10 4 1 6 4 6 8 4 1 6 5 4 9-3 5-10 6-16 4-6-2-10-6-8-11z" />
          <path d="M22 20c1-4 4-6 6-5" />
        </>
      );
    case "grapes":
      return (
        <>
          <circle cx="20" cy="22" r="5" />
          <circle cx="29" cy="22" r="5" />
          <circle cx="16" cy="30" r="5" />
          <circle cx="25" cy="30" r="5" />
          <circle cx="33" cy="30" r="4.5" />
          <path d="M24 17v-6" />
          <path d="M24 13c4-2 7-1 8 2" />
        </>
      );
    case "ice-cream":
      return (
        <>
          <path d="M16 22c0-6 3.5-10 8-10s8 4 8 10H16z" />
          <path d="M18 22 24 42 30 22" />
          <path d="M21 28h6M22.5 34h3" />
        </>
      );
    case "leafy":
      return (
        <>
          <path d="M24 40c0-12 4-20 14-26-8 2-14 8-14 26z" />
          <path d="M24 40c0-10-6-18-16-22 8 2 14 8 16 22z" />
          <path d="M24 18v22" />
        </>
      );
    case "meat":
      return (
        <>
          <path d="M14 24c0-6 6-12 14-12 6 0 10 4 12 8 2 6-2 14-8 16-8 3-18-4-18-12z" />
          <path d="M18 22c4 2 8 2 12-1" />
          <circle cx="20" cy="28" r="1.4" fill="currentColor" stroke="none" />
        </>
      );
    case "milk":
      return (
        <>
          <path d="M15 21.5h18v16a2 2 0 0 1-2 2H17a2 2 0 0 1-2-2v-16z" />
          <path d="M15 21.5 24 12.5 33 21.5" />
          <path d="M24 12.5v9" />
          <path d="M19.5 29.5h9" />
        </>
      );
    case "mushroom":
      return (
        <>
          <path d="M10 24c2-10 8-14 14-14s12 4 14 14H10z" />
          <path d="M20 24v10a4 4 0 0 0 8 0V24" />
          <path d="M16 22h4M28 20h3" />
        </>
      );
    case "onion":
      return (
        <>
          <path d="M24 41c-8 0-12.6-6-12.6-13.2C11.4 19.6 16.2 13 24 10.6 31.8 13 36.6 19.6 36.6 27.8 36.6 35 32 41 24 41z" />
          <path d="M24 10.6V6.8" />
          <path d="M19.6 8.8c1.6 1.8 3.2 2.2 4.4.4" />
          <path d="M24 18.5c-5.2 3-7.4 8.2-6.2 14.5" />
        </>
      );
    case "pasta":
      return (
        <>
          <ellipse cx="24" cy="30" rx="15" ry="4.6" />
          <path d="M9 30c1.6 9 7.4 14.5 15 14.5S37.4 39 39 30" />
          <path d="M16 28c2.2-6.5 4.6-8.2 6.4-5" />
          <path d="M22 27.5c2.2-7.5 5.2-8.6 6.4-4.6" />
          <path d="M28.5 28c1.6-5.5 3.8-6.4 4.8-3" />
        </>
      );
    case "pear":
      return (
        <>
          <path d="M24 12c4 4 6 8 6 12 4 2 8 8 6 14-2 6-8 8-12 8s-10-2-12-8c-2-6 2-12 6-14 0-4 2-8 6-12z" />
          <path d="M24 12v-4" />
        </>
      );
    case "pepper":
      return (
        <>
          <path d="M18 18c0-4 2-6 6-6s6 2 6 6c6 2 8 8 6 14-2 8-6 12-12 12s-10-4-12-12c-2-6 0-12 6-14z" />
          <path d="M24 12v-4" />
          <path d="M22 10h6" />
        </>
      );
    case "pizza":
      return (
        <>
          <path d="M12 16 36 20 24 42Z" />
          <circle cx="22" cy="26" r="1.6" />
          <circle cx="28" cy="30" r="1.6" />
          <circle cx="22" cy="34" r="1.4" />
        </>
      );
    case "potato":
      return (
        <>
          <path d="M16 22c0-8 6-12 14-10 6 1 10 6 10 12 0 8-4 14-12 14-8 0-12-6-12-16z" />
          <circle cx="22" cy="24" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="30" cy="28" r="1.2" fill="currentColor" stroke="none" />
        </>
      );
    case "rice":
      return (
        <>
          <path d="M10 22h28l-3 14a8 8 0 0 1-8 6h-6a8 8 0 0 1-8-6L10 22z" />
          <path d="M18 30h.5M24 28h.5M28 33h.5M21 35h.5" />
        </>
      );
    case "roll":
      return (
        <>
          <path d="M10 28c0-8 6-12 14-12s14 4 14 12-6 10-14 10S10 36 10 28z" />
          <path d="M16 26c2 3 6 4 8 4s6-1 8-4" />
        </>
      );
    case "sausage":
      return (
        <>
          <path d="M8 22c4-6 10-6 14 0s10 6 14 0 6-2 6 2-4 8-10 8-10-2-14 2-10 4-14 0-6-6-4-10 4-8 8-2z" />
        </>
      );
    case "shrimp":
      return (
        <>
          <path d="M14 30c2-10 10-16 18-14 4 1 6 5 4 9-4 1-6 4-4 8 2 4-2 8-8 8-8 0-12-5-10-11z" />
          <path d="M16 18c-2-4-1-8 2-8" />
          <path d="M20 24c4 1 6 4 5 7" />
        </>
      );
    case "strawberry":
      return (
        <>
          <path d="M24 20c7 1.5 11 8 9.5 16.5C31.5 44 27 46 24 46s-7.5-2-9.5-9.5C13 28 17 21.5 24 20z" />
          <path d="M24 20V15" />
          <path d="M24 16c-5-1.2-8.2 1.6-7.2 4.8 2.4-1.2 5-1.6 7.2-4.8z" />
          <path d="M24 16c5-1.2 8.2 1.6 7.2 4.8-2.4-1.2-5-1.6-7.2-4.8z" />
          <circle cx="20" cy="30" r="1.15" fill="currentColor" stroke="none" />
          <circle cx="27" cy="33" r="1.15" fill="currentColor" stroke="none" />
          <circle cx="21.5" cy="38" r="1.05" fill="currentColor" stroke="none" />
        </>
      );
    case "toilet-paper":
      return (
        <>
          <ellipse cx="24" cy="16" rx="10" ry="5" />
          <path d="M14 16v14c0 3 4.5 5 10 5s10-2 10-5V16" />
          <path d="M34 18v16" />
          <circle cx="24" cy="16" r="2" />
        </>
      );
    case "tomato":
      return (
        <>
          <circle cx="24" cy="29.5" r="11.2" />
          <path d="M24 18.2V14.2" />
          <path d="M24 18.2c-6.2-1.2-10 2-8.6 5.4 3-1.6 6-2 8.6-5.4z" />
          <path d="M24 18.2c6.2-1.2 10 2 8.6 5.4-3-1.6-6-2-8.6-5.4z" />
        </>
      );
    case "yogurt":
      return (
        <>
          <path d="M15 16h18v3H15z" />
          <path d="M16.5 19h15l-1.6 15a6 6 0 0 1-11.8 0L16.5 19z" />
          <path d="M20 27h8" />
        </>
      );
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}
