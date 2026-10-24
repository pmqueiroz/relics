import type { FaceSide } from "../../../components/artifact/types";

export const RELIC_MIME = "application/vnd.relic+binary";
export const RELIC_EXTENSION = ".relic";
export const RELIC_VERSION = 1;

export const RELIC_FLAG = {
  obverse: 1 << 0,
  reverse: 1 << 1,
  customObj: 1 << 2,
  zstd: 1 << 3,
} as const;

export const RELIC_IMAGE_TYPES = ["image/webp", "image/png", "image/jpeg"];

const MAGIC = [0x52, 0x4c, 0x49, 0x43];
const HEADER_LENGTH = 20;
const SUPPORTED_FLAGS = RELIC_FLAG.obverse | RELIC_FLAG.reverse;
const FACE_FLAG: Record<FaceSide, number> = {
  obv: RELIC_FLAG.obverse,
  rev: RELIC_FLAG.reverse,
};
const FACES: FaceSide[] = ["obv", "rev"];

export type RelicAsset = { bytes: Uint8Array<ArrayBuffer>; type: string };

export type RelicAssets = Partial<Record<FaceSide, RelicAsset>>;

export type RelicAssetEntry = { offset: number; length: number; type: string };

export type RelicContents = {
  manifest: Record<string, unknown>;
  assets: RelicAssets;
};

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function align4(length: number) {
  return (length + 3) & ~3;
}

export function sameAsset(a: RelicAsset | undefined, b: RelicAsset) {
  return (
    a !== undefined &&
    a.type === b.type &&
    a.bytes.length === b.bytes.length &&
    a.bytes.every((byte, index) => byte === b.bytes[index])
  );
}

export function encodeRelic({ manifest, assets }: RelicContents) {
  const entries: Partial<Record<FaceSide, RelicAssetEntry>> = {};
  let flags = 0;
  let binLength = 0;
  for (const face of FACES) {
    const asset = assets[face];
    if (!asset) continue;
    if (!RELIC_IMAGE_TYPES.includes(asset.type))
      throw new Error(`unsupported ${face} image type ${asset.type}`);
    const shared = FACES.find(
      (other) => entries[other] && sameAsset(assets[other], asset),
    );
    flags |= FACE_FLAG[face];
    if (shared) {
      entries[face] = entries[shared];
      continue;
    }
    entries[face] = {
      offset: binLength,
      length: asset.bytes.length,
      type: asset.type,
    };
    binLength = align4(binLength + asset.bytes.length);
  }

  const json = new TextEncoder().encode(
    JSON.stringify({ ...manifest, assets: entries }),
  );
  const metaLength = align4(json.length);
  const file = new Uint8Array(HEADER_LENGTH + metaLength + binLength);
  const view = new DataView(file.buffer);

  file.set(MAGIC, 0);
  view.setUint16(4, RELIC_VERSION, true);
  view.setUint16(6, flags, true);
  view.setUint32(8, metaLength, true);
  view.setUint32(12, binLength, true);
  file.set(json, HEADER_LENGTH);
  file.fill(0x20, HEADER_LENGTH + json.length, HEADER_LENGTH + metaLength);
  for (const face of FACES) {
    const entry = entries[face];
    const asset = assets[face];
    if (entry && asset)
      file.set(asset.bytes, HEADER_LENGTH + metaLength + entry.offset);
  }
  view.setUint32(16, crc32(file.subarray(HEADER_LENGTH)), true);
  return file;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readAssetEntry(value: unknown, binLength: number, face: FaceSide) {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.offset) ||
    !Number.isInteger(value.length) ||
    typeof value.type !== "string"
  )
    throw new Error(`malformed ${face} asset entry`);
  const entry = value as RelicAssetEntry;
  if (entry.offset % 4 !== 0) throw new Error(`unaligned ${face} asset`);
  if (entry.offset < 0 || entry.offset + entry.length > binLength)
    throw new Error(`${face} asset out of buffer range`);
  if (!RELIC_IMAGE_TYPES.includes(entry.type))
    throw new Error(`unsupported ${face} image type ${entry.type}`);
  return entry;
}

export function decodeRelic(file: Uint8Array): RelicContents {
  if (file.length < HEADER_LENGTH) throw new Error("file too short");
  if (MAGIC.some((byte, index) => file[index] !== byte))
    throw new Error("not a relic file");
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const version = view.getUint16(4, true);
  if (version !== RELIC_VERSION)
    throw new Error(`unsupported version ${version}`);
  const flags = view.getUint16(6, true);
  if (flags & ~SUPPORTED_FLAGS)
    throw new Error(`reserved flag set 0x${flags.toString(16)}`);
  const metaLength = view.getUint32(8, true);
  const binLength = view.getUint32(12, true);
  if (metaLength % 4 !== 0 || binLength % 4 !== 0)
    throw new Error("unaligned chunk length");
  if (file.length !== HEADER_LENGTH + metaLength + binLength)
    throw new Error("length mismatch");
  if (crc32(file.subarray(HEADER_LENGTH)) !== view.getUint32(16, true))
    throw new Error("checksum mismatch");

  let manifest: unknown;
  try {
    manifest = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        file.subarray(HEADER_LENGTH, HEADER_LENGTH + metaLength),
      ),
    );
  } catch {
    throw new Error("unreadable manifest");
  }
  if (!isRecord(manifest)) throw new Error("unreadable manifest");

  const binStart = HEADER_LENGTH + metaLength;
  const entries = isRecord(manifest.assets) ? manifest.assets : {};
  const assets: RelicAssets = {};
  for (const face of FACES) {
    const flagged = (flags & FACE_FLAG[face]) !== 0;
    if (flagged !== face in entries)
      throw new Error(`${face} flag does not match manifest`);
    if (!flagged) continue;
    const entry = readAssetEntry(entries[face], binLength, face);
    assets[face] = {
      bytes: file.slice(
        binStart + entry.offset,
        binStart + entry.offset + entry.length,
      ),
      type: entry.type,
    };
  }
  const { assets: _, ...rest } = manifest;
  return { manifest: rest, assets };
}
