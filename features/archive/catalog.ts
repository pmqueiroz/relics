import type { ArtifactKind, Geometry } from "../../components/artifact/types";
import type { Dictionary } from "../../i18n/dictionary";
import type { ArtifactModel } from "./artifact-config";

export type Condition =
  | "UNC"
  | "AU"
  | "XF"
  | "VF"
  | "F"
  | "Mint"
  | "Used"
  | "MNH"
  | "MH";

type BaseItem = {
  id: string;
  title: string;
  origin: string;
  iso: string;
  year: number | null;
  amount: number;
  cond: Condition;
  face: string;
  model: ArtifactModel;
  faces: { obv: string | null; rev: string | null };
};

export type CoinItem = BaseItem & {
  kind: "coin";
  cur: string;
  denom: string;
  mint: string;
  metal: string;
  dia: string;
  thk: string;
  wt: string;
  edge: string;
};

export type NoteItem = BaseItem & {
  kind: "note";
  cur: string;
  denom: string;
  series: string;
  printer: string;
  size: string;
  paper: string;
};

export type CardItem = BaseItem & {
  kind: "card";
  issuer: string;
  units: string;
  chip: string;
};

export type StampItem = BaseItem & {
  kind: "stamp";
  cur: string;
  denom: string;
  perf: string;
  printing: string;
  size: string;
  paper: string;
};

export type CatalogItem = CoinItem | NoteItem | CardItem | StampItem;

export type Domain = "all" | ArtifactKind;

export type SortKey = "id" | "year" | "origin" | "cond";

export const KINDS: ArtifactKind[] = ["coin", "note", "card", "stamp"];

export const DOMAINS: Domain[] = ["all", ...KINDS];

export function domainTitle(domain: Domain, dict: Dictionary) {
  return domain === "all" ? dict.indexTitle : dict.domain[domain];
}

export const SORTS: SortKey[] = ["id", "year", "origin", "cond"];

export const CONDITION_RANK: Record<Condition, number> = {
  UNC: 1,
  Mint: 1,
  MNH: 1,
  AU: 2,
  MH: 2,
  XF: 3,
  VF: 4,
  Used: 4,
  F: 5,
};

export const CARD_DIMENSIONS = "85.60 × 53.98 × 0.76 mm";

export function itemField(item: CatalogItem, field: string): unknown {
  return (item as Record<string, unknown>)[field];
}

const KIND_GEOMETRY: Record<ArtifactKind, Geometry> = {
  coin: { dia: 24, thk: 1.8, bevel: 1, edge: "reeded" },
  note: { w: 150, h: 76, curve: 1.5 },
  card: {
    w: 85.6,
    h: 53.98,
    r: 3.18,
    thk: 0.76,
    chipX: 9.4,
    chipY: 19.7,
    chip: true,
  },
  stamp: { w: 20, h: 24, perf: 14, hole: 0.55, margin: 1.6 },
};

export function kindGeometry(kind: ArtifactKind): Geometry {
  return { ...KIND_GEOMETRY[kind] };
}

export function itemYear(item: CatalogItem) {
  return item.year === null ? "—" : String(item.year);
}

export function itemSearchUrl(item: CatalogItem, dict: Dictionary) {
  const query = [dict.kind[item.kind], item.title, item.face]
    .filter(Boolean)
    .join(" ");
  return `https://www.google.com/search?${new URLSearchParams({ q: query })}`;
}

export function itemSubtitle(item: CatalogItem) {
  const parts =
    item.kind === "card"
      ? [itemYear(item), item.iso, item.units, item.cond]
      : [itemYear(item), item.iso, `${item.denom} ${item.cur}`, item.cond];
  return parts.join(" · ");
}

export function amountLabel(item: CatalogItem) {
  return item.amount > 1 ? `${item.amount}x` : "";
}

export function itemSummary(item: CatalogItem, dict: Dictionary) {
  return dict.summary(dict.kind[item.kind], item.origin, itemSubtitle(item));
}
