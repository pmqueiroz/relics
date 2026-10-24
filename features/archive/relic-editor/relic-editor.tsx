"use client";

import { useRouter } from "next/navigation";
import {
  type ReactNode,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { Artifact } from "../../../components/artifact/artifact";
import type { ArtifactKind } from "../../../components/artifact/types";
import { Button, buttonClass } from "../../../components/ui/button";
import { cx } from "../../../components/ui/cx";
import {
  SearchLink,
  withCurrentSearch,
} from "../../../components/ui/search-link";
import { SectionLabel } from "../../../components/ui/section-label";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import {
  COMPACT_QUERY,
  useMediaQuery,
} from "../../../components/ui/use-media-query";
import { useDictionary, useLocale } from "../../../i18n/locale-provider";
import { localePath } from "../../../i18n/locales";
import { relicPagePath } from "../artifact-config";
import { KINDS, kindGeometry } from "../catalog";
import { SPEC_FIELDS } from "../relic/manifest";
import { isRecord } from "../relic/relic-file";
import type { TextureDraft } from "../texture-editor/texture-draft";
import { TextureEditor } from "../texture-editor/texture-editor";
import { encodeTexture } from "../texture-editor/texture-file";
import { CONDITIONS, ENTRY_TEXT_FIELDS, kindSpecs } from "./entry-draft";
import { saveRelic } from "./save-relic";

type RelicEditorProps = {
  initial: TextureDraft;
  previousId: string | null;
  cloneOf?: string;
  suggestedIds?: Record<ArtifactKind, string>;
};

const INPUT =
  "box-border h-8 w-full min-w-0 rounded-xs border border-line bg-surface px-2.5 mono text-touch text-ink outline-none regular:h-7 regular:text-xs";

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid h-12 grid-cols-[92px_minmax(0,1fr)] items-center gap-3 border-b border-line regular:h-9">
      <span className="whitespace-nowrap mono text-tag uppercase text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" ? String(value) : "";
}

export function RelicEditor(props: RelicEditorProps) {
  const { bfcacheId } = useRouter();
  return <RelicEditorForm key={bfcacheId} {...props} />;
}

function RelicEditorForm({
  initial,
  previousId,
  cloneOf,
  suggestedIds,
}: RelicEditorProps) {
  const [draft, setDraft] = useState(initial);
  const [editingTexture, setEditingTexture] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const compact = useMediaQuery(COMPACT_QUERY);
  const dict = useDictionary();
  const locale = useLocale();
  const router = useRouter();
  const { meta } = draft;
  const specs = isRecord(meta.specs) ? meta.specs : {};
  const id = textValue(meta.id);
  const sourceId = previousId ?? cloneOf;
  const backHref = sourceId
    ? relicPagePath(locale, sourceId)
    : localePath(locale);
  const sides = [
    { value: false, label: dict.side.obv },
    { value: true, label: dict.side.rev },
  ];

  const setMeta = (patch: Record<string, unknown>) =>
    setDraft((current) => ({
      ...current,
      meta: { ...current.meta, ...patch },
    }));

  const setSpec = (field: string, value: string) =>
    setMeta({ specs: { ...specs, [field]: value } });

  const setKind = (kind: ArtifactKind) =>
    setDraft((current) => {
      const currentId = textValue(current.meta.id);
      const suggested = suggestedIds?.[current.kind];
      return {
        ...current,
        kind,
        geo: kindGeometry(kind),
        meta: {
          ...current.meta,
          id:
            suggestedIds && (!currentId || currentId === suggested)
              ? suggestedIds[kind]
              : currentId,
          specs: kindSpecs(kind, current.meta.specs),
        },
      };
    });

  const setTexture = (action: SetStateAction<TextureDraft>) =>
    setDraft((current) => {
      const next = typeof action === "function" ? action(current) : action;
      const meta =
        next.kind === current.kind
          ? current.meta
          : {
              ...current.meta,
              specs: kindSpecs(next.kind, current.meta.specs),
            };
      return { ...next, meta };
    });

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setStatus("saving…");
    try {
      const form = new FormData();
      form.set("relic", new Blob([await encodeTexture(draft)]));
      if (previousId) form.set("previousId", previousId);
      const result = await saveRelic(form);
      if ("error" in result) {
        setStatus(result.error);
        return;
      }
      setStatus(`saved relics/${result.id}.relic`);
      router.push(withCurrentSearch(relicPagePath(locale, result.id)));
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const keys = useRef({ save, editingTexture });
  keys.current = { save, editingTexture };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (keys.current.editingTexture) return;
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        keys.current.save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-line pt-safe glass">
        <div className="flex items-center gap-3 px-4 py-3.5 regular:px-7">
          <SearchLink
            href={backHref}
            className={cx(buttonClass("outline", "adaptive"), "no-underline")}
          >
            ‹ Back
          </SearchLink>
          <h1 className="truncate text-sm font-semibold">
            {previousId
              ? `Edit ${previousId}`
              : cloneOf
                ? `Clone ${cloneOf}`
                : "New entry"}
          </h1>
          <span className="flex-none rounded-xs border border-dev-line bg-dev px-1.5 mono text-tag uppercase tracking-label">
            dev
          </span>
          <div className="ml-auto hidden truncate mono text-meta text-faint regular:block">
            {status || (previousId ? `relics/${previousId}.relic` : "unsaved")}
          </div>
          <Button
            variant="primary"
            size="adaptive"
            onClick={save}
            disabled={saving}
            className="ml-auto regular:ml-0"
          >
            Save
          </Button>
        </div>
        {status && (
          <div className="truncate px-4 pb-2 mono text-meta text-faint regular:hidden">
            {status}
          </div>
        )}
      </header>

      <main className="grid grid-cols-1 split:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div className="flex flex-col gap-3 px-4 pt-5 regular:px-7 split:sticky split:top-[59px] split:self-start">
          <div className="relative h-[44vh] min-h-70 rounded-xs bg-surface regular:h-[60vh]">
            <Artifact
              {...draft}
              face={textValue(meta.face)}
              code={id}
              year={numberValue(meta.year) || "—"}
              origin={textValue(meta.origin)}
              mode="orbit"
              rotating
              flipped={flipped}
              zoom={1}
              fit={290}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              size={compact ? "fill" : "md"}
              options={sides}
              value={flipped}
              onChange={setFlipped}
            />
            <Button size="adaptive" onClick={() => setEditingTexture(true)}>
              {dict.header.textureEditor}…
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-[22px] px-4 pb-12 pt-5 regular:px-7">
          <div className="flex flex-col">
            <SectionLabel className="pb-2">Entry</SectionLabel>
            <FieldRow label="kind">
              <SegmentedControl
                className="justify-self-start"
                options={KINDS.map((value) => ({
                  value,
                  label: dict.kind[value],
                }))}
                value={draft.kind}
                onChange={setKind}
                disabled={previousId !== null}
              />
            </FieldRow>
            {ENTRY_TEXT_FIELDS.map((field) => (
              <FieldRow key={field} label={field}>
                <input
                  value={textValue(meta[field])}
                  aria-label={field}
                  onChange={(event) => setMeta({ [field]: event.target.value })}
                  spellCheck={false}
                  className={INPUT}
                />
              </FieldRow>
            ))}
            <FieldRow label="year">
              <input
                type="number"
                step={1}
                value={numberValue(meta.year)}
                aria-label="year"
                placeholder="unknown"
                onChange={(event) =>
                  setMeta({
                    year:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  })
                }
                className={INPUT}
              />
            </FieldRow>
            <FieldRow label="amount">
              <input
                type="number"
                min={1}
                step={1}
                value={numberValue(meta.amount)}
                aria-label="amount"
                onChange={(event) =>
                  setMeta({ amount: Number(event.target.value) })
                }
                className={INPUT}
              />
            </FieldRow>
            <FieldRow label="cond">
              <select
                value={textValue(meta.cond)}
                aria-label="cond"
                onChange={(event) => setMeta({ cond: event.target.value })}
                className={INPUT}
              >
                {CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond} · {dict.condition[cond]}
                  </option>
                ))}
              </select>
            </FieldRow>
          </div>

          <div className="flex flex-col">
            <SectionLabel className="pb-2">
              Specs · {dict.kind[draft.kind]}
            </SectionLabel>
            {SPEC_FIELDS[draft.kind].map((field) => (
              <FieldRow key={field} label={field}>
                <input
                  value={textValue(specs[field])}
                  aria-label={field}
                  onChange={(event) => setSpec(field, event.target.value)}
                  spellCheck={false}
                  className={INPUT}
                />
              </FieldRow>
            ))}
          </div>
        </div>
      </main>

      {editingTexture && (
        <TextureEditor
          compact={compact}
          draft={draft}
          onDraft={setTexture}
          onClose={() => setEditingTexture(false)}
          save={{
            label: "Save",
            run: () => {
              setEditingTexture(false);
              save();
            },
          }}
        />
      )}
    </div>
  );
}
