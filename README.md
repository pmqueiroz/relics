<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.png">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/banner-light.png">
  <img alt="Relics" src=".github/assets/banner-light.png" width="100%">
</picture>

My catalog of my collectibles (coins, banknotes, stamps,
phonecards).

## How it works

- **The data is files.** Every catalog entry is one binary `.relic` file in
  `relics/`. There is no database and no upload endpoint: the repo is the
  catalog, and adding an object means committing a file.
- **Read at build time.** `loadCatalog()` decodes and validates every relic
  under `'use cache'`. A malformed file fails the build with
  `relics/<file>: <reason>` instead of shipping a broken entry.
- **Textures are served, not inlined.** Face scans live inside the relic;
  `app/relics/[id]/[face]` slices them out as images and is prerendered for
  every entry, so page payloads never carry Base64 images.
- **Editing is a dev-time tool.** Under `next dev` a relic editor (yellow
  controls, compiled out of production) writes `relics/<id>.relic` through a
  Server Action. The texture editor crops scans to the face shape and bakes
  them into the file. Production is read-only.
- **Every relic is linkable.** `/<lang>/relics/<id>` is a share page with
  its own generated preview card (OG image).

## The `.relic` file

A chunked binary container, one file holds
everything about an object.

```
0x00  header   20 B   "RLIC" · version u16 · flags u16 · meta_len u32 · bin_len u32 · crc32 u32
0x14  META     N B    UTF-8 JSON manifest, space-padded to a multiple of 4
      BUFF     M B    raw image bytes (webp / png / jpeg), each 4-byte aligned
```

- **Manifest** holds universal fields (id, kind, title, origin, year,
  condition, amount), a per-kind `specs` block (mint, metal, diameter…), a
  parametric `model` for the 3D mesh, and `assets` offsets into the buffer.
- **Raw bytes, not Base64**, so no ~33% bloat. Identical obverse/reverse
  images are stored once and referenced twice.
- **Strict decoder.** Little-endian, CRC-32 over both chunks, exact length
  check; unknown versions and unknown or reserved flags are rejected rather
  than guessed at.
- **Isomorphic codec** (`features/archive/relic/relic-file.ts`): no Node or
  DOM APIs, so the server loader and the in-browser editor share it.

Full byte layout, flags and manifest rules: [`.refs/relic.md`](./.refs/relic.md).

## Architecture decisions

- **CSS 3D, not WebGL.** The artifact viewer is a `preserve-3d` rig built
  from DOM layers, with meshes generated from millimetre geometry per kind.
  It stays light and crisp, at the cost of not rendering arbitrary meshes
  (which is why the custom `.obj` flag is reserved). The grid draws a flat
  front face per card and only mounts the full rig on hover.
- **Localized routes.** Every page sits under `/[lang]` (`en`, `pt-BR`);
  `proxy.ts` negotiates the locale. Typed dictionaries, no i18n library:
  English defines the shape and a missing translation is a type error.
- **Dev-only code never ships.** `*.dev.tsx` routes are only page
  extensions under the dev phase, and inline `NODE_ENV` checks strip
  dev UI from production bundles.

## Layout

```
app/[lang]/          pages: index, relic share page, dev-only editors
app/relics/          texture route (locale-independent)
features/archive/    catalog, views, relic codec, editors
components/          shared UI, 3D artifact viewer, brand mark
i18n/                locales, dictionaries, provider
relics/              the catalog: one .relic per entry
.refs/               architecture and feature notes for agentic harness
```
