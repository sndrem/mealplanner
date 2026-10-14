export type LandingMealId =
  | "kjottkaker"
  | "laks"
  | "pasta"
  | "wok"
  | "taco"
  | "pizza"
  | "lapskaus";

const stroke = "#1c2b24";

export function LandingMealIcon({ id }: { id: LandingMealId }) {
  return <span className="block h-16 w-16">{mealIcon(id)}</span>;
}

function mealIcon(id: LandingMealId) {
  switch (id) {
    case "kjottkaker":
      return (
        <svg aria-hidden="true" className="h-full w-full" viewBox="0 0 64 64">
          <ellipse cx="32" cy="46" fill="#f3e2c4" rx="20" ry="7" stroke={stroke} strokeWidth="2.5" />
          <circle cx="24" cy="34" fill="#c46b4a" r="9" stroke={stroke} strokeWidth="2.5" />
          <circle cx="38" cy="31" fill="#a8533a" r="10" stroke={stroke} strokeWidth="2.5" />
        </svg>
      );
    case "laks":
      return (
        <svg aria-hidden="true" className="h-full w-full" viewBox="0 0 64 64">
          <ellipse cx="28" cy="34" fill="#f0a07a" rx="16" ry="11" stroke={stroke} strokeWidth="2.5" />
          <path d="M42 34 L56 22 L54 34 L56 46 Z" fill="#e36b4f" stroke={stroke} strokeLinejoin="round" strokeWidth="2.5" />
          <circle cx="20" cy="32" fill={stroke} r="1.8" />
        </svg>
      );
    case "pasta":
      return (
        <svg aria-hidden="true" className="h-full w-full" viewBox="0 0 64 64">
          <path d="M14 30 H50 L46 50 Q32 56 18 50 Z" fill="#f3e2c4" stroke={stroke} strokeLinejoin="round" strokeWidth="2.5" />
          <path d="M22 30 Q24 18 20 14 M32 30 Q34 16 30 12 M42 30 Q44 18 40 14" fill="none" stroke="#e36b4f" strokeLinecap="round" strokeWidth="2.5" />
        </svg>
      );
    case "wok":
      return (
        <svg aria-hidden="true" className="h-full w-full" viewBox="0 0 64 64">
          <path d="M10 30 H54 L48 48 Q32 56 16 48 Z" fill="#31423b" stroke={stroke} strokeLinejoin="round" strokeWidth="2.5" />
          <path d="M20 26 Q24 14 18 10" fill="none" stroke="#9bb0a8" strokeLinecap="round" strokeWidth="2" />
          <circle cx="28" cy="38" fill="#3d9a78" r="3.5" stroke={stroke} strokeWidth="1.5" />
          <circle cx="38" cy="40" fill="#e36b4f" r="3.5" stroke={stroke} strokeWidth="1.5" />
          <circle cx="34" cy="33" fill="#f0c14d" r="3" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case "taco":
      return (
        <svg aria-hidden="true" className="h-full w-full" viewBox="0 0 64 64">
          <path d="M12 26 Q32 14 52 26 L44 48 Q32 40 20 48 Z" fill="#f0c14d" stroke={stroke} strokeLinejoin="round" strokeWidth="2.5" />
          <path d="M20 30 Q32 38 44 30" fill="none" stroke="#3d9a78" strokeLinecap="round" strokeWidth="3" />
          <circle cx="27" cy="34" fill="#e36b4f" r="2.2" />
          <circle cx="36" cy="36" fill="#e36b4f" r="2.2" />
        </svg>
      );
    case "pizza":
      return (
        <svg aria-hidden="true" className="h-full w-full" viewBox="0 0 64 64">
          <circle cx="32" cy="34" fill="#f0c14d" r="18" stroke={stroke} strokeWidth="2.5" />
          <path d="M32 16 V52 M16 34 H48" stroke={stroke} strokeWidth="2" />
          <circle cx="26" cy="28" fill="#e36b4f" r="2.4" />
          <circle cx="40" cy="30" fill="#3d9a78" r="2.2" />
          <circle cx="36" cy="42" fill="#c46b4a" r="2.4" />
        </svg>
      );
    case "lapskaus":
      return (
        <svg aria-hidden="true" className="h-full w-full" viewBox="0 0 64 64">
          <path d="M14 28 H50 L46 50 Q32 58 18 50 Z" fill="#f3e2c4" stroke={stroke} strokeLinejoin="round" strokeWidth="2.5" />
          <rect fill="#c46b4a" height="8" rx="2" stroke={stroke} strokeWidth="1.5" width="8" x="22" y="34" />
          <rect fill="#3d9a78" height="8" rx="2" stroke={stroke} strokeWidth="1.5" width="8" x="34" y="36" />
          <rect fill="#e36b4f" height="7" rx="2" stroke={stroke} strokeWidth="1.5" width="7" x="28" y="30" />
        </svg>
      );
  }
}
