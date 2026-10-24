import { DEFAULT_FIT } from "../../components/artifact/geometry";
import type { FaceSide, Fit, Geometry } from "../../components/artifact/types";
import { type Locale, localePath } from "../../i18n/locales";
import { type CatalogItem, itemYear } from "./catalog";

export type ArtifactModel = {
  geo: Geometry;
  fo: Fit;
  fr: Fit;
};

export type ArtifactConfig = ArtifactModel & {
  obv: string;
  rev: string;
};

export function blankConfig(geo: Geometry): ArtifactConfig {
  return {
    geo,
    obv: "",
    rev: "",
    fo: { ...DEFAULT_FIT },
    fr: { ...DEFAULT_FIT },
  };
}

export function relicPagePath(locale: Locale, id: string) {
  return localePath(locale, `/relics/${encodeURIComponent(id)}`);
}

export function relicAssetUrl(id: string, face: FaceSide, version: string) {
  return `/relics/${encodeURIComponent(id)}/${face}?v=${version}`;
}

function itemConfig(item: CatalogItem): ArtifactConfig {
  return {
    ...item.model,
    obv: item.faces.obv ? relicAssetUrl(item.id, "obv", item.faces.obv) : "",
    rev: item.faces.rev ? relicAssetUrl(item.id, "rev", item.faces.rev) : "",
  };
}

export function artifactProps(
  item: CatalogItem,
  config: ArtifactConfig = itemConfig(item),
) {
  return {
    kind: item.kind,
    face: item.face,
    code: item.id,
    year: itemYear(item),
    origin: item.origin,
    ...config,
  };
}
