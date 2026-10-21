import { normalizeIngredientCanonicalName } from "./ingredient-normalize";

const namesByIcon = {
  apple: ["Eple"],
  avocado: ["Avokado"],
  banana: ["Banan"],
  bread: [
    "Brød",
    "Grovt brød",
    "Loff",
    "Knekkebrød",
    "Pitabrød",
    "Nanbrød",
    "Tortillalefser",
  ],
  broccoli: ["Brokkoli", "Blomkål", "Asparges", "Frosne grønnsaker"],
  butter: ["Smør", "Margarin"],
  carrot: ["Gulrot"],
  cheese: ["Ost", "Brunost", "Mozzarella", "Parmesan", "Cottage cheese"],
  chicken: ["Kyllingfilet", "Kyllinglår", "Frossen kylling"],
  chocolate: ["Sjokolade"],
  citrus: ["Appelsin", "Mandarin", "Sitron", "Lime"],
  coffee: ["Kaffe", "Te", "Kakao"],
  corn: ["Mais"],
  cream: ["Rømme", "Crème fraîche", "Kremfløte", "Matfløte", "Kesam"],
  cucumber: ["Agurk", "Squash"],
  diaper: ["Bleier"],
  egg: ["Egg"],
  eggplant: ["Aubergine"],
  fish: [
    "Laksefilet",
    "Torsk",
    "Sei",
    "Fiskekaker",
    "Fiskepinner",
    "Frossen laks",
  ],
  flower: ["Blomster"],
  garlic: ["Hvitløk"],
  ginger: ["Ingefær"],
  grapes: ["Druer"],
  "ice-cream": ["Iskrem"],
  leafy: ["Salat", "Spinat", "Kål"],
  meat: [
    "Kjøttdeig",
    "Karbonadedeig",
    "Svinekjøtt",
    "Biff",
    "Lammekjøtt",
    "Bacon",
    "Kjøttpålegg",
    "Salami",
    "Skinke",
    "Leverpostei",
    "Farse",
  ],
  milk: ["Melk", "Lettmelk", "Helmelk", "Kefir"],
  mushroom: ["Sopp"],
  onion: ["Løk", "Rødløk", "Purreløk"],
  pasta: ["Pasta", "Spaghetti", "Nudler", "Lasagne"],
  pear: ["Pære"],
  pepper: ["Paprika", "Chili"],
  pizza: ["Frossenpizza"],
  potato: ["Potet", "Søtpotet", "Pommes frites"],
  rice: [
    "Ris",
    "Basmatiris",
    "Havregryn",
    "Mel",
    "Sukker",
    "Brunt sukker",
    "Cornflakes",
    "Müsli",
  ],
  roll: [
    "Rundstykker",
    "Croissant",
    "Boller",
    "Kanelsnurr",
    "Hamburgerbrød",
    "Pølsebrød",
  ],
  sausage: ["Pølser"],
  shrimp: ["Reker", "Krabbe"],
  strawberry: ["Jordbær", "Blåbær", "Bringebær", "Frosne bær"],
  "toilet-paper": ["Toalettpapir", "Tørkepapir", "Servietter", "Våtservietter"],
  tomato: ["Tomat", "Cherrytomat"],
  yogurt: ["Yoghurt", "Gresk yoghurt"],
} as const;

export type ShoppingItemIconKey = keyof typeof namesByIcon;

const shoppingItemIconByName = buildShoppingItemIconByName(namesByIcon);

export type ResolvedShoppingItemIcon =
  | {
      kind: "diagram";
      key: ShoppingItemIconKey;
    }
  | {
      kind: "letter";
      letter: string;
    };

export function hasExplicitShoppingItemIcon(name: string) {
  return Object.prototype.hasOwnProperty.call(
    shoppingItemIconByName,
    normalizeIngredientCanonicalName(name),
  );
}

export function resolveShoppingItemIcon({
  name,
}: {
  categoryKey?: string | null;
  name: string;
}): ResolvedShoppingItemIcon {
  const explicit =
    shoppingItemIconByName[normalizeIngredientCanonicalName(name)];

  if (explicit) {
    return { kind: "diagram", key: explicit };
  }

  return { kind: "letter", letter: shoppingItemIconLetter(name) };
}

export function shoppingItemIconLetter(name: string) {
  const normalized = normalizeIngredientCanonicalName(name);
  const match = normalized.match(/\p{L}/u);

  return (match?.[0] ?? "?").toLocaleUpperCase("nb");
}

function buildShoppingItemIconByName(
  groups: Record<ShoppingItemIconKey, readonly string[]>,
) {
  const map: Partial<Record<string, ShoppingItemIconKey>> = {};

  for (const [icon, names] of Object.entries(groups) as Array<
    [ShoppingItemIconKey, readonly string[]]
  >) {
    for (const name of names) {
      const normalized = normalizeIngredientCanonicalName(name);

      if (map[normalized]) {
        throw new Error(`Duplicate shopping icon name: ${name}`);
      }

      map[normalized] = icon;
    }
  }

  return map;
}
