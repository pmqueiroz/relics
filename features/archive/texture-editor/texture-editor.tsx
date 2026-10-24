"use client";

import {
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { Artifact } from "../../../components/artifact/artifact";
import { DEFAULT_FIT } from "../../../components/artifact/geometry";
import type {
  ArtifactKind,
  FaceSide,
  Fit,
  Geometry,
} from "../../../components/artifact/types";
import { Button, buttonClass } from "../../../components/ui/button";
import { cx } from "../../../components/ui/cx";
import { RangeField } from "../../../components/ui/range-field";
import { SectionLabel } from "../../../components/ui/section-label";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { useDictionary } from "../../../i18n/locale-provider";
import { KINDS, kindGeometry } from "../catalog";
import { RELIC_EXTENSION, RELIC_MIME } from "../relic/relic-file";
import { downloadTemplate } from "./download-template";
import { FaceEditor } from "./face-editor";
import { canEncodeWebp, ingestImage } from "./ingest-image";
import {
  displayValue,
  FIT_FIELDS,
  GEOMETRY_FIELDS,
  OPTION_FIELDS,
} from "./schema";
import { blankTexture, type TextureDraft } from "./texture-draft";
import {
  catalogId,
  downloadTexture,
  openTexture,
  textureFileName,
} from "./texture-file";

type TextureEditorProps = {
  compact: boolean;
  draft: TextureDraft;
  onDraft: Dispatch<SetStateAction<TextureDraft>>;
  onClose: () => void;
  save?: { label: string; run: () => void };
};

const FIT_KEY: Record<FaceSide, "fo" | "fr"> = { obv: "fo", rev: "fr" };

const SHEET_BUTTON =
  "h-11 cursor-pointer whitespace-nowrap border-0 bg-transparent px-3 text-touch tracking-ui text-ink";

export function TextureEditor({
  compact,
  draft,
  onDraft: setDraft,
  onClose,
  save,
}: TextureEditorProps) {
  const [side, setSide] = useState<FaceSide>("obv");
  const [spinning, setSpinning] = useState(false);
  const [status, setStatus] = useState("");
  const [webp] = useState(canEncodeWebp);
  const dict = useDictionary();
  const text = dict.editor;
  const kindOptions = KINDS.map((value) => ({
    value,
    label: dict.kind[value],
  }));
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fitKey = FIT_KEY[side];
  const fit = draft[fitKey];
  const image = draft[side];
  const sideLabel = text.side[side];

  const setGeo = <K extends keyof Geometry>(key: K, value: Geometry[K]) =>
    setDraft((current) => ({
      ...current,
      geo: { ...current.geo, [key]: value },
    }));
  const setFit = (patch: Partial<Fit>) =>
    setDraft((current) => ({
      ...current,
      [fitKey]: { ...current[fitKey], ...patch },
    }));

  const ingest = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = await ingestImage(file);
      if (!result) return;
      setDraft((current) => ({
        ...current,
        [side]: result.dataUrl,
        [fitKey]: { ...DEFAULT_FIT },
      }));
      setStatus(
        text.status.ingested(
          side,
          `${result.width}×${result.height}`,
          result.kilobytes,
        ),
      );
    } catch {
      setStatus(text.status.unreadable);
    }
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    ingest(file);
  };

  const setKind = (kind: ArtifactKind) =>
    setDraft((current) => ({ ...current, kind, geo: kindGeometry(kind) }));

  const openRelic = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setDraft(await openTexture(file));
      setStatus(text.status.opened(file.name));
    } catch (error) {
      setStatus(`${file.name} · ${(error as Error).message}`);
    }
  };

  const download = async () => {
    try {
      await downloadTexture(draft);
      setStatus(text.status.downloaded(textureFileName(draft)));
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const primary = save ?? { label: text.download, run: download };

  const clear = () => {
    setDraft(blankTexture(draft.kind));
    setStatus(text.status.cleared);
  };

  const entryId = catalogId(draft);
  const statusText =
    status || (entryId ? text.status.entryDraft(entryId) : text.status.draft);
  const openButton = (
    <label className={cx(buttonClass("outline", "adaptive"), "box-border")}>
      {text.open}
      <input
        type="file"
        accept={`${RELIC_EXTENSION},${RELIC_MIME}`}
        onChange={openRelic}
        className="hidden"
      />
    </label>
  );

  return (
    <div
      className={cx(
        "fixed inset-0 z-50 box-border flex justify-center",
        compact ? "items-end pt-2.5" : "items-center p-6",
      )}
    >
      <div
        aria-hidden
        onClick={compact ? onClose : undefined}
        className="absolute inset-0 bg-ink/16 transition-opacity duration-300 starting:opacity-0"
      />
      <div
        role="dialog"
        aria-modal
        aria-label={text.title}
        className={cx(
          "relative flex flex-col overflow-hidden border border-line bg-paper shadow-modal transition-[translate,scale,opacity] duration-450 ease-drawer",
          compact
            ? "size-full rounded-t-xl starting:translate-y-[101%]"
            : "h-[min(800px,100%)] w-[min(1120px,100%)] rounded-xs starting:translate-y-3 starting:scale-[0.985] starting:opacity-0",
        )}
      >
        {compact ? (
          <div className="flex flex-none flex-col items-center border-b border-line">
            <div className="mt-1.5 h-[5px] w-9 rounded-[3px] bg-[#C2C1BC]" />
            <div className="box-border grid h-12 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-1">
              <button
                type="button"
                onClick={onClose}
                className={cx(SHEET_BUTTON, "justify-self-start")}
              >
                {text.close}
              </button>
              <div className="flex flex-col items-center gap-px">
                <div className="whitespace-nowrap text-heading font-semibold">
                  {text.title}
                </div>
                <div className="whitespace-nowrap mono text-meta text-muted">
                  {dict.kind[draft.kind]}
                </div>
              </div>
              {webp && (
                <button
                  type="button"
                  onClick={primary.run}
                  className={cx(SHEET_BUTTON, "justify-self-end font-semibold")}
                >
                  {primary.label}
                </button>
              )}
            </div>
            <div className="flex w-full px-4 pb-2.5">
              <SegmentedControl
                size="fill"
                options={kindOptions}
                value={draft.kind}
                onChange={setKind}
                disabled={entryId !== null}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 border-b border-line px-5 py-3">
            <div className="text-heading font-medium">{text.title}</div>
            <SegmentedControl
              size="md"
              options={kindOptions}
              value={draft.kind}
              onChange={setKind}
              disabled={entryId !== null}
            />
            <div className="mr-auto mono text-tag uppercase tracking-label text-faint">
              {text.sections}
            </div>
            <Button onClick={onClose}>{text.close} · Esc</Button>
          </div>
        )}

        {!webp && (
          <div
            role="alert"
            className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
          >
            <div className="text-heading font-medium">
              {text.webpUnsupported.title}
            </div>
            <div className="max-w-[360px] text-meta text-muted">
              {text.webpUnsupported.body}
            </div>
          </div>
        )}

        {webp && (
          <>
            <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-1 content-start overflow-y-auto overscroll-contain split:auto-rows-auto split:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] split:content-stretch split:overflow-hidden">
              <div className="flex flex-col border-b border-line split:min-h-0 split:overflow-y-auto split:border-b-0 split:border-r">
                <div
                  className={cx(
                    "relative flex-none border-b border-line bg-surface",
                    compact
                      ? "h-[min(300px,30vh)]"
                      : "h-[clamp(200px,36vh,340px)]",
                  )}
                >
                  <Artifact
                    {...draft}
                    face=""
                    code={dict.kind[draft.kind]}
                    year=""
                    origin=""
                    mode="orbit"
                    rotating={spinning}
                    flipped={side === "rev"}
                    zoom={1}
                    fit={270}
                  />
                  <div className="pointer-events-none absolute left-3.5 top-3 mono text-tag text-faint">
                    {text.live}
                  </div>
                  <Button
                    onClick={() => setSpinning((value) => !value)}
                    className="absolute bottom-3 right-3"
                  >
                    {spinning ? `❚❚ ${text.hold}` : `▶ ${text.orbit}`}
                  </Button>
                </div>
                <div className="flex flex-none flex-col gap-3 px-5 pb-4 pt-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <SegmentedControl
                      size="md"
                      value={side}
                      onChange={setSide}
                      options={(["obv", "rev"] as const).map((value) => ({
                        value,
                        label: (
                          <>
                            {dict.side[value]}
                            <span className="text-[9px]">
                              {draft[value] ? "■" : "□"}
                            </span>
                          </>
                        ),
                      }))}
                    />
                    <div className="ml-auto flex flex-wrap gap-1.5">
                      <label className={cx(buttonClass(), "box-border")}>
                        {text.image}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={onFileInput}
                          className="hidden"
                        />
                      </label>
                      <Button
                        onClick={() =>
                          setDraft((current) => ({ ...current, [side]: "" }))
                        }
                        className={image ? "text-ink" : "text-faint"}
                      >
                        {text.remove}
                      </Button>
                      <Button
                        onClick={() =>
                          downloadTemplate(
                            draft.kind,
                            draft.geo,
                            side,
                            `${dict.kind[draft.kind]} · ${dict.side[side]}`,
                          )
                        }
                      >
                        {text.template} ↓
                      </Button>
                    </div>
                  </div>
                  <FaceEditor
                    kind={draft.kind}
                    geo={draft.geo}
                    image={image}
                    fit={fit}
                    sideLabel={sideLabel}
                    hint={compact ? text.hintTouch : text.hintPointer}
                    onFit={setFit}
                    onFile={ingest}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-[22px] px-5 pb-6 pt-3.5 split:min-h-0 split:overflow-y-auto">
                <div className="flex flex-col">
                  <SectionLabel className="pb-2">
                    {text.fit} · {sideLabel}
                  </SectionLabel>
                  {FIT_FIELDS.map((field) => (
                    <RangeField
                      key={field.key}
                      label={text.fitField[field.key]}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={displayValue(fit[field.key], field.step)}
                      onChange={(value) => setFit({ [field.key]: value })}
                    />
                  ))}
                </div>
                <div className="flex flex-col">
                  <SectionLabel className="pb-2">
                    {text.mesh} · {dict.kind[draft.kind]}
                  </SectionLabel>
                  {GEOMETRY_FIELDS[draft.kind].map((field) => (
                    <RangeField
                      key={field.key}
                      label={text.geometryField[field.key]}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={displayValue(draft.geo[field.key], field.step)}
                      onChange={(value) => setGeo(field.key, value)}
                    />
                  ))}
                  {OPTION_FIELDS[draft.kind].map((option) => (
                    <div
                      key={option.key}
                      className="grid h-12 grid-cols-[92px_minmax(0,1fr)] items-center gap-3 border-b border-line regular:h-9"
                    >
                      <div className="mono text-tag uppercase text-muted">
                        {text.option[option.key]}
                      </div>
                      {option.key === "edge" ? (
                        <SegmentedControl
                          className="justify-self-start"
                          options={option.choices.map((choice) => ({
                            value: choice.value,
                            label: text.choice[choice.label],
                          }))}
                          value={draft.geo.edge ?? "reeded"}
                          onChange={(value) => setGeo("edge", value)}
                        />
                      ) : (
                        <SegmentedControl
                          className="justify-self-start"
                          options={option.choices.map((choice) => ({
                            value: choice.value,
                            label: text.choice[choice.label],
                          }))}
                          value={draft.geo.chip !== false}
                          onChange={(value) => setGeo("chip", value)}
                        />
                      )}
                    </div>
                  ))}
                  <div className="flex gap-1.5 pt-3">
                    <Button
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          geo: kindGeometry(current.kind),
                        }))
                      }
                    >
                      {text.meshDefaults}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div
              className={cx(
                "flex flex-none items-center gap-2 border-t border-line",
                compact ? "min-h-12 px-4 pb-safe" : "px-5 py-3",
              )}
            >
              <div className="truncate whitespace-nowrap mono text-meta text-faint">
                {statusText}
              </div>
              <div className="ml-auto flex gap-1.5">
                {openButton}
                <Button size="adaptive" onClick={clear}>
                  {text.clear}
                </Button>
                {!compact && (
                  <>
                    <Button onClick={onClose}>{text.close}</Button>
                    <Button variant="primary" onClick={primary.run}>
                      {primary.label}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
