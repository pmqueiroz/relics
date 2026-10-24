import { DEFAULT_FIT } from "../../../components/artifact/geometry";
import type { ArtifactKind } from "../../../components/artifact/types";
import type { ArtifactModel } from "../artifact-config";
import {
  type CatalogItem,
  CONDITION_RANK,
  type Condition,
  KINDS,
  kindGeometry,
} from "../catalog";
import {
  crc32,
  isRecord,
  type RelicAsset,
  type RelicContents,
} from "./relic-file";

function assetVersion(asset: RelicAsset | undefined) {
  return asset ? crc32(asset.bytes).toString(36) : null;
}

export const SPEC_FIELDS: Record<ArtifactKind, string[]> = {
  coin: ["cur", "denom", "mint", "metal", "dia", "thk", "wt", "edge"],
  note: ["cur", "denom", "series", "printer", "size", "paper"],
  card: ["issuer", "units", "chip"],
  stamp: ["cur", "denom", "perf", "printing", "size", "paper"],
};

const TEXT_FIELDS = ["id", "title", "origin", "iso", "face"] as const;

export function mergeTyped<T extends Record<string, unknown>>(
  base: T,
  value: unknown,
): T {
  if (!isRecord(value)) return base;
  const merged: Record<string, unknown> = { ...base };
  for (const key of Object.keys(merged))
    if (typeof value[key] === typeof merged[key]) merged[key] = value[key];
  return merged as T;
}

export function parseKind(value: unknown) {
  return KINDS.find((kind) => kind === value);
}

export function parseModel(kind: ArtifactKind, value: unknown): ArtifactModel {
  const model = isRecord(value) ? value : {};
  return {
    geo: mergeTyped(kindGeometry(kind), model.geo),
    fo: mergeTyped(DEFAULT_FIT, model.fo),
    fr: mergeTyped(DEFAULT_FIT, model.fr),
  };
}

function parseYear(value: unknown) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value)) throw new Error("invalid year");
  return value as number;
}

function parseAmount(value: unknown) {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || (value as number) < 1)
    throw new Error("invalid amount");
  return value as number;
}

function isCondition(value: unknown): value is Condition {
  return typeof value === "string" && value in CONDITION_RANK;
}

export function parseCatalogEntry({
  manifest,
  assets,
}: RelicContents): CatalogItem {
  const kind = parseKind(manifest.kind);
  if (!kind) throw new Error(`unknown kind ${String(manifest.kind)}`);
  for (const field of TEXT_FIELDS)
    if (typeof manifest[field] !== "string")
      throw new Error(`missing ${field}`);
  if (!isCondition(manifest.cond)) throw new Error("unknown condition");
  const specs = isRecord(manifest.specs) ? manifest.specs : {};
  for (const field of SPEC_FIELDS[kind])
    if (typeof specs[field] !== "string")
      throw new Error(`missing specs.${field}`);

  const entry: Record<string, unknown> = {
    kind,
    id: manifest.id,
    title: manifest.title,
    origin: manifest.origin,
    iso: manifest.iso,
    year: parseYear(manifest.year),
    amount: parseAmount(manifest.amount),
    cond: manifest.cond,
    face: manifest.face,
    model: parseModel(kind, manifest.model),
    faces: { obv: assetVersion(assets.obv), rev: assetVersion(assets.rev) },
  };
  for (const field of SPEC_FIELDS[kind]) entry[field] = specs[field];
  return entry as CatalogItem;
}
