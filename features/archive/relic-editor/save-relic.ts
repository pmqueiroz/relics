"use server";

import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { updateTag } from "next/cache";
import {
  loadCatalog,
  RELIC_CACHE_TAG,
  RELIC_DIR,
  readRelic,
} from "../relic/load-catalog";
import { parseCatalogEntry } from "../relic/manifest";
import {
  decodeRelic,
  encodeRelic,
  RELIC_EXTENSION,
  type RelicContents,
} from "../relic/relic-file";
import { optimizeAssets } from "./optimize-assets";

export type SaveRelicResult = { id: string } | { error: string };

const RELIC_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function relicFile(id: string) {
  return path.join(RELIC_DIR, `${id}${RELIC_EXTENSION}`);
}

export async function saveRelic(formData: FormData): Promise<SaveRelicResult> {
  if (process.env.NODE_ENV !== "development")
    return { error: "relic editing is dev-only" };
  const upload = formData.get("relic");
  const previous = formData.get("previousId") || null;
  if (!(upload instanceof Blob)) return { error: "missing relic" };
  if (previous !== null && typeof previous !== "string")
    return { error: "invalid previous id" };

  let contents: RelicContents;
  let id: string;
  try {
    contents = decodeRelic(new Uint8Array(await upload.arrayBuffer()));
    id = parseCatalogEntry(contents).id;
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (!RELIC_ID.test(id)) return { error: `invalid id “${id}”` };

  const ids = (await loadCatalog()).map((item) => item.id);
  if (previous !== null && !ids.includes(previous))
    return { error: `unknown entry ${previous}` };
  if (id !== previous && ids.includes(id))
    return { error: `${id} already exists` };

  const stored =
    previous === null
      ? {}
      : (await readRelic(`${previous}${RELIC_EXTENSION}`)).assets;
  const assets = await optimizeAssets(contents.assets, stored);
  await writeFile(relicFile(id), encodeRelic({ ...contents, assets }));
  if (previous !== null && previous !== id) await unlink(relicFile(previous));
  updateTag(RELIC_CACHE_TAG);
  return { id };
}
