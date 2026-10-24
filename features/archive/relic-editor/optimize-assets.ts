import sharp from "sharp";
import type { FaceSide } from "../../../components/artifact/types";
import {
  type RelicAsset,
  type RelicAssets,
  sameAsset,
} from "../relic/relic-file";

const WEBP = "image/webp";
const WEBP_OPTIONS = { quality: 75, effort: 6 } as const;
const FACES: FaceSide[] = ["obv", "rev"];

export async function optimizeAsset(asset: RelicAsset): Promise<RelicAsset> {
  if (asset.type !== WEBP) return asset;
  const encoded = await sharp(asset.bytes).webp(WEBP_OPTIONS).toBuffer();
  if (encoded.length >= asset.bytes.length) return asset;
  return { bytes: new Uint8Array(encoded), type: WEBP };
}

export async function optimizeAssets(
  assets: RelicAssets,
  stored: RelicAssets = {},
): Promise<RelicAssets> {
  const kept = Object.values(stored);
  const optimized: RelicAssets = {};
  for (const face of FACES) {
    const asset = assets[face];
    if (!asset) continue;
    const twin = FACES.find(
      (other) => optimized[other] && sameAsset(assets[other], asset),
    );
    if (twin) optimized[face] = optimized[twin];
    else if (kept.some((previous) => sameAsset(previous, asset)))
      optimized[face] = asset;
    else optimized[face] = await optimizeAsset(asset);
  }
  return optimized;
}
