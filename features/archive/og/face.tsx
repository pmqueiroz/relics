import sharp from "sharp";
import type { ArtifactKind } from "../../../components/artifact/types";
import { PALETTE } from "../../../components/brand/palette";
import type { CatalogItem } from "../catalog";
import { readRelicAsset } from "../relic/load-catalog";

const SILHOUETTE: Record<
  ArtifactKind,
  { width: number; height: number; radius: number }
> = {
  coin: { width: 300, height: 300, radius: 150 },
  note: { width: 420, height: 213, radius: 4 },
  card: { width: 380, height: 240, radius: 14 },
  stamp: { width: 250, height: 300, radius: 2 },
};

export function hasFaceScan(item: CatalogItem) {
  return Boolean(item.faces.obv || item.faces.rev);
}

export async function faceImage(item: CatalogItem, maxSize: number) {
  const side = item.faces.obv ? "obv" : item.faces.rev ? "rev" : null;
  const asset = side ? await readRelicAsset(item.id, side) : null;
  if (!asset) return null;
  const png = await sharp(asset.bytes)
    .resize(maxSize, maxSize, { fit: "inside" })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

export function Face({
  image,
  kind,
  scale = 1,
}: {
  image: string | null;
  kind: ArtifactKind;
  scale?: number;
}) {
  if (image) {
    return (
      <img
        src={image}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    );
  }
  const shape = SILHOUETTE[kind];
  return (
    <div
      style={{
        width: shape.width * scale,
        height: shape.height * scale,
        borderRadius: shape.radius * scale,
        background: PALETTE.graphite,
        opacity: 0.85,
      }}
    />
  );
}
