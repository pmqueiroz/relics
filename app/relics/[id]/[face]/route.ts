import type { FaceSide } from "../../../../components/artifact/types";
import {
  loadCatalog,
  readRelicAsset,
} from "../../../../features/archive/relic/load-catalog";

const FACES: FaceSide[] = ["obv", "rev"];

export async function generateStaticParams() {
  const catalog = await loadCatalog();
  return catalog.flatMap((item) =>
    FACES.map((face) => ({ id: item.id, face })),
  );
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/relics/[id]/[face]">,
) {
  const { id, face } = await params;
  const side = FACES.find((option) => option === face);
  const asset = side ? await readRelicAsset(id, side) : null;
  if (!asset) return new Response(null, { status: 404 });
  return new Response(asset.bytes, {
    headers: {
      "Content-Type": asset.type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
