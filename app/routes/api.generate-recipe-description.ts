import { data } from "react-router";
import { z } from "zod";

const RequestSchema = z.object({
  ingredients: z.array(
    z.object({
      amount: z.string().nullable(),
      displayName: z.string(),
      unit: z.string().nullable(),
    }),
  ),
  title: z.string().min(1),
});

export async function action({ request }: { request: Request }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return data({ error: "Gemini API-nøkkel er ikke konfigurert." }, { status: 500 });
  }

  const body = await request.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return data({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const { title, ingredients } = parsed.data;
  const ingredientList = ingredients
    .map((i) => [i.amount, i.unit, i.displayName].filter(Boolean).join(" "))
    .join(", ");

  const prompt = `Du er en erfaren kokk. Lag en kort, trinnvis oppskrift på norsk for "${title}" basert på disse ingrediensene: ${ingredientList}. Skriv tydelige steg nummerert 1, 2, 3 osv. Ikke gjenta ingredienslisten, gå rett på fremgangsmåten.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("Gemini API error:", res.status, errorBody);
      return data({ error: "Kunne ikke generere beskrivelse. Prøv igjen senere." }, { status: 502 });
    }

    const json = await res.json();
    const description =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

    if (!description) {
      return data({ error: "Fikk tomt svar fra AI." }, { status: 502 });
    }

    return data({ description });
  } catch (err) {
    console.error("Gemini fetch failed:", err);
    return data({ error: "Nettverksfeil ved generering av beskrivelse." }, { status: 502 });
  }
}
