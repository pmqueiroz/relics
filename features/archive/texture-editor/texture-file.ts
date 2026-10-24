import { DEFAULT_FIT } from "../../../components/artifact/geometry";
import type { FaceSide } from "../../../components/artifact/types";
import { parseKind, parseModel } from "../relic/manifest";
import {
  decodeRelic,
  encodeRelic,
  RELIC_EXTENSION,
  RELIC_MIME,
  type RelicAsset,
  type RelicAssets,
  type RelicContents,
} from "../relic/relic-file";
import { templateDimensions } from "./download-template";
import { cropToFace } from "./ingest-image";
import type { TextureDraft } from "./texture-draft";

const FACES: FaceSide[] = ["obv", "rev"];
const FIT_KEY = { obv: "fo", rev: "fr" } as const;

export function catalogId(draft: TextureDraft) {
  return typeof draft.meta.id === "string" ? draft.meta.id : null;
}

export function textureFileName(draft: TextureDraft) {
  return `${catalogId(draft) ?? draft.kind}${RELIC_EXTENSION}`;
}

async function dataUrlAsset(dataUrl: string): Promise<RelicAsset> {
  const blob = await (await fetch(dataUrl)).blob();
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type };
}

function assetDataUrl(asset: RelicAsset) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([asset.bytes], { type: asset.type }));
  });
}

export async function encodeTexture(draft: TextureDraft) {
  const [faceWidth, faceHeight] = templateDimensions(draft.kind, draft.geo);
  const assets: RelicAssets = {};
  for (const face of FACES) {
    const src = draft[face];
    if (!src) continue;
    const cropped = await cropToFace(
      src,
      draft[FIT_KEY[face]],
      faceWidth,
      faceHeight,
    );
    assets[face] = await dataUrlAsset(cropped);
  }
  return encodeRelic({
    manifest: {
      ...draft.meta,
      kind: draft.kind,
      model: { geo: draft.geo, fo: { ...DEFAULT_FIT }, fr: { ...DEFAULT_FIT } },
    },
    assets,
  });
}

export async function downloadTexture(draft: TextureDraft) {
  const file = await encodeTexture(draft);
  const url = URL.createObjectURL(new Blob([file], { type: RELIC_MIME }));
  const link = document.createElement("a");
  link.href = url;
  link.download = textureFileName(draft);
  link.click();
  URL.revokeObjectURL(url);
}

export async function textureFromRelic(
  { manifest, assets }: RelicContents,
  toDataUrl: (asset: RelicAsset) => string | Promise<string>,
): Promise<TextureDraft> {
  const kind = parseKind(manifest.kind);
  if (!kind) throw new Error("unknown kind");
  const { kind: _kind, model, ...meta } = manifest;
  return {
    kind,
    meta,
    ...parseModel(kind, model),
    obv: assets.obv ? await toDataUrl(assets.obv) : "",
    rev: assets.rev ? await toDataUrl(assets.rev) : "",
  };
}

export async function openTexture(file: File): Promise<TextureDraft> {
  return textureFromRelic(
    decodeRelic(new Uint8Array(await file.arrayBuffer())),
    assetDataUrl,
  );
}
