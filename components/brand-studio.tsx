"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { isAccentHex } from "@/lib/brand";

type Phase =
  | { kind: "idle" }
  | { kind: "still" }
  | { kind: "motion" }
  | { kind: "done"; videoUrl: string }
  | { kind: "error"; message: string };

const FIELD =
  "w-full bg-transparent text-[15px] text-paper outline-none placeholder:text-mute/60";

export function BrandStudio() {
  const [product, setProduct] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [productUrl, setProductUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [vibes, setVibes] = useState<[string, string, string]>(["", "", ""]);
  const [accent, setAccent] = useState("#E7D7C1");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!product) {
      setProductUrl(null);
      return;
    }
    const url = URL.createObjectURL(product);
    setProductUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [product]);

  useEffect(() => {
    if (!logo) {
      setLogoUrl(null);
      return;
    }
    const url = URL.createObjectURL(logo);
    setLogoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  useEffect(() => {
    if (phase.kind === "idle") return;
    statusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [phase]);

  const accentValid = isAccentHex(accent.trim());
  const ready =
    product !== null &&
    name.trim().length > 0 &&
    vibes.every((word) => word.trim().length > 0) &&
    accentValid;
  const running = phase.kind === "still" || phase.kind === "motion";

  function setVibe(index: 0 | 1 | 2, value: string) {
    setVibes((current) => {
      const next: [string, string, string] = [current[0], current[1], current[2]];
      next[index] = value;
      return next;
    });
  }

  function onAccentBlur() {
    const raw = accent.trim();
    const withHash = raw.startsWith("#") ? raw : `#${raw}`;
    if (isAccentHex(withHash)) setAccent(withHash.toUpperCase());
  }

  async function onGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !product || running) return;

    setPhase({ kind: "still" });
    const body = new FormData();
    body.set("product", product);
    body.set("brandName", name.trim());
    body.set("vibe1", vibes[0].trim());
    body.set("vibe2", vibes[1].trim());
    body.set("vibe3", vibes[2].trim());
    body.set("accentColor", accent.trim());
    if (logo) body.set("logo", logo);

    try {
      const response = await fetch("/api/generate", { method: "POST", body });
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || type.includes("application/json")) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        setPhase({
          kind: "error",
          message: data?.message || "Generation failed. Nothing was generated.",
        });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setPhase({ kind: "error", message: "The generation stream did not start. Nothing was generated." });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      const take = (line: string) => {
        if (!line.trim() || finished) return;
        const event = JSON.parse(line) as {
          step?: string;
          videoUrl?: string;
          message?: string;
        };
        if (event.step === "still") setPhase({ kind: "still" });
        if (event.step === "motion") setPhase({ kind: "motion" });
        if (event.step === "done" && event.videoUrl) {
          finished = true;
          setPhase({ kind: "done", videoUrl: event.videoUrl });
        }
        if (event.step === "error") {
          finished = true;
          setPhase({
            kind: "error",
            message: event.message || "Generation failed. Nothing was generated.",
          });
        }
      };

      while (!finished) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) take(line);
        if (done) {
          take(buffer);
          break;
        }
      }

      if (!finished) {
        setPhase({
          kind: "error",
          message: "Generation ended without a video URL. Nothing was generated.",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not reach KOVA.";
      setPhase({ kind: "error", message: `${message} Nothing was generated.` });
    }
  }

  return (
    <form onSubmit={onGenerate} className="flex flex-col">
      <label className="mx-auto flex w-[11.5rem] cursor-pointer flex-col" htmlFor="product-photo">
        <span className="mb-3 text-center text-[11px] uppercase tracking-[0.22em] text-mute">
          Product
        </span>
        <span className="relative flex aspect-[9/16] items-center justify-center overflow-hidden border border-line bg-raised">
          {productUrl ? (
            // Blob previews are local and short-lived; next/image cannot serve them.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={productUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="px-4 text-center text-[12px] tracking-[0.18em] text-mute">9:16</span>
          )}
        </span>
        <input
          id="product-photo"
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) setProduct(file);
          }}
        />
      </label>

      <div className="mt-14">
        <label htmlFor="brand-name" className="text-[11px] uppercase tracking-[0.22em] text-mute">
          Brand
        </label>
        <input
          id="brand-name"
          value={name}
          maxLength={80}
          placeholder="Northline"
          onChange={(event) => setName(event.target.value)}
          className={`${FIELD} mt-3 border-b border-line pb-3`}
        />
      </div>

      <fieldset className="mt-12 border-0 p-0">
        <legend className="text-[11px] uppercase tracking-[0.22em] text-mute">Vibe</legend>
        {([0, 1, 2] as const).map((index) => (
          <label key={index} className="mt-1 flex items-baseline gap-4 border-b border-line py-3">
            <span className="w-6 text-[11px] tracking-[0.16em] text-mute">0{index + 1}</span>
            <input
              value={vibes[index]}
              maxLength={40}
              placeholder={["minimal", "nocturnal", "precise"][index]}
              aria-label={`Vibe word ${index + 1}`}
              onChange={(event) => setVibe(index, event.target.value)}
              className={FIELD}
            />
          </label>
        ))}
      </fieldset>

      <div className="mt-12">
        <label htmlFor="accent-hex" className="text-[11px] uppercase tracking-[0.22em] text-mute">
          Accent
        </label>
        <div className="mt-3 flex items-center gap-4 border-b border-line pb-3">
          <span className="relative h-6 w-6 shrink-0 overflow-hidden border border-line">
            <span
              className="absolute inset-0"
              style={{ background: accentValid ? accent : "transparent" }}
            />
            <input
              aria-label="Accent color"
              type="color"
              value={accentValid ? accent : "#E7D7C1"}
              onChange={(event) => setAccent(event.target.value.toUpperCase())}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </span>
          <input
            id="accent-hex"
            value={accent}
            spellCheck={false}
            maxLength={7}
            onChange={(event) => setAccent(event.target.value)}
            onBlur={onAccentBlur}
            className={`${FIELD} uppercase tracking-[0.14em]`}
          />
        </div>
      </div>

      <div className="mt-12">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="logo-file" className="text-[11px] uppercase tracking-[0.22em] text-mute">
            Logo
            <span className="ml-2 tracking-[0.14em] normal-case">optional</span>
          </label>
          {logo ? (
            <button
              type="button"
              className="text-[11px] uppercase tracking-[0.16em] text-mute"
              onClick={() => setLogo(null)}
            >
              Remove
            </button>
          ) : null}
        </div>
        <label
          htmlFor="logo-file"
          className="mt-3 flex cursor-pointer items-center gap-4 border-b border-line pb-3"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-line bg-raised">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="text-[10px] tracking-[0.14em] text-mute">+</span>
            )}
          </span>
          <span className="text-[13px] text-mute">{logo ? logo.name : "Add a mark"}</span>
        </label>
        <input
          id="logo-file"
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) setLogo(file);
            event.target.value = "";
          }}
        />
      </div>

      <button
        type="submit"
        disabled={!ready || running}
        className="mt-14 h-12 bg-brass text-[12px] uppercase tracking-[0.22em] text-ink disabled:cursor-not-allowed disabled:opacity-35"
      >
        Generate
      </button>

      <div ref={statusRef} className="mt-10 scroll-mt-16" aria-live="polite">
        {phase.kind === "still" || phase.kind === "motion" ? <Loading phase={phase.kind} /> : null}
        {phase.kind === "error" ? (
          <p role="alert" className="text-center text-[14px] leading-relaxed text-danger">
            {phase.message}
          </p>
        ) : null}
        {phase.kind === "done" ? <Result videoUrl={phase.videoUrl} brandName={name} /> : null}
      </div>
    </form>
  );
}

function Loading({ phase }: { phase: "still" | "motion" }) {
  const label = phase === "still" ? "Building your scene…" : "Directing the shot…";
  const note =
    phase === "still"
      ? "The product stays as photographed."
      : "Fifteen seconds, vertical. This part takes longer.";

  return (
    <div>
      <div className="relative mx-auto flex aspect-[9/16] w-[11.5rem] items-end overflow-hidden border border-line bg-raised p-4">
        <div className="kova-sheen" />
        <p className="relative text-[13px] leading-snug text-paper">{label}</p>
      </div>
      <ol className="mx-auto mt-6 w-[11.5rem] space-y-2 text-[12px]">
        <li className={phase === "still" ? "text-paper" : "text-brass"}>Building your scene…</li>
        <li className={phase === "motion" ? "text-paper" : "text-mute"}>Directing the shot…</li>
      </ol>
      <p className="mx-auto mt-4 w-[11.5rem] text-[12px] leading-relaxed text-mute">{note}</p>
    </div>
  );
}

function Result({ videoUrl, brandName }: { videoUrl: string; brandName: string }) {
  const fileName = `${brandName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kova"}.mp4`;

  return (
    <div className="mx-auto w-full max-w-[20rem]">
      <div className="aspect-[9/16] overflow-hidden border border-line bg-black">
        <video src={videoUrl} className="h-full w-full object-contain" controls autoPlay playsInline muted />
      </div>
      <a
        href={videoUrl}
        download={fileName}
        className="mt-4 flex h-12 items-center justify-center border border-brass text-[12px] uppercase tracking-[0.22em] text-brass"
      >
        Download
      </a>
    </div>
  );
}
