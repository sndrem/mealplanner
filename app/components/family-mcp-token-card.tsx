import { useState } from "react";
import { Form } from "react-router";

export function FamilyMcpTokenCard({
  hasMcpToken,
  isCreating,
  isRevoking,
  isRotating,
  mcpToken,
  mcpUrl,
}: {
  hasMcpToken: boolean;
  isCreating: boolean;
  isRevoking: boolean;
  isRotating: boolean;
  mcpToken?: string;
  mcpUrl: string;
}) {
  return (
    <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-slate-950">AI-tilgang (MCP)</h2>
        <p className="text-sm leading-6 text-slate-600">
          Lag et hemmelig nøkkelord som en AI-agent kan bruke for å lese
          oppskrifter, ukeplan og handleliste. Del det ikke offentlig. Bytt
          nøkkel hvis det kommer på avveie.
        </p>
      </div>

      <label className="mt-6 block text-sm font-medium text-slate-700">
        MCP-adresse
        <input
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none transition focus:border-slate-400"
          readOnly
          value={mcpUrl}
        />
      </label>
      <CopyButton label="Kopier adresse" value={mcpUrl} />

      {mcpToken ? <McpTokenResult token={mcpToken} /> : null}

      {!hasMcpToken ? (
        <Form className="mt-6" method="post">
          <input name="intent" type="hidden" value="create-mcp-token" />
          <button
            className="inline-flex w-fit items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            type="submit"
          >
            {isCreating ? "Oppretter..." : "Opprett nøkkel"}
          </button>
        </Form>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          <Form
            method="post"
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Bytter du nøkkel, slutter eksisterende agenter å få tilgang. Fortsette?",
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <input name="intent" type="hidden" value="rotate-mcp-token" />
            <button
              className="inline-flex w-fit items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              type="submit"
            >
              {isRotating ? "Bytter nøkkel..." : "Bytt nøkkel"}
            </button>
          </Form>
          <Form
            method="post"
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Opphever du nøkkelen, mister agenter tilgang til familiens data. Fortsette?",
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <input name="intent" type="hidden" value="revoke-mcp-token" />
            <button
              className="inline-flex w-fit items-center justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-rose-700"
              type="submit"
            >
              {isRevoking ? "Opphever..." : "Opphev"}
            </button>
          </Form>
        </div>
      )}
    </section>
  );
}

function McpTokenResult({ token }: { token: string }) {
  return (
    <div className="mt-6 grid gap-2">
      <p className="text-sm font-medium text-slate-950">Nøkkelen er klar</p>
      <p className="text-sm leading-6 text-slate-600">
        Kopier nøkkelen nå — den vises ikke igjen. Bruk den som Bearer-token mot
        MCP-adressen.
      </p>
      <label className="block text-sm font-medium text-slate-700">
        Nøkkel
        <input
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none transition focus:border-slate-400"
          readOnly
          value={token}
        />
      </label>
      <CopyButton label="Kopier nøkkel" value={token} />
    </div>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  return (
    <>
      <button
        className="mt-2 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopyState("copied");
          } catch {
            setCopyState("failed");
          }
        }}
        type="button"
      >
        {copyState === "copied" ? "Kopiert" : label}
      </button>
      {copyState === "failed" ? (
        <p className="mt-2 text-sm text-rose-700">
          Kunne ikke kopiere. Marker feltet og kopier manuelt.
        </p>
      ) : null}
    </>
  );
}
