import type { ArtifactKind } from "../../../components/artifact/types";
import { CONDITION_RANK, type Condition } from "../catalog";
import { SPEC_FIELDS } from "../relic/manifest";
import { isRecord } from "../relic/relic-file";
import {
  blankTexture,
  type TextureDraft,
} from "../texture-editor/texture-draft";

export const CONDITIONS = Object.keys(CONDITION_RANK) as Condition[];

export const ENTRY_TEXT_FIELDS = [
  "id",
  "title",
  "origin",
  "iso",
  "face",
] as const;

export function kindSpecs(kind: ArtifactKind, specs: unknown) {
  const current = isRecord(specs) ? specs : {};
  return Object.fromEntries(
    SPEC_FIELDS[kind].map((field) => [
      field,
      typeof current[field] === "string" ? current[field] : "—",
    ]),
  );
}

export function blankEntry(kind: ArtifactKind, id: string): TextureDraft {
  return {
    ...blankTexture(kind),
    meta: {
      id,
      title: "",
      origin: "",
      iso: "",
      year: null,
      amount: 1,
      cond: "VF",
      face: "",
      specs: kindSpecs(kind, {}),
    },
  };
}
