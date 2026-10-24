# Archive Index

The home route (`/<lang>`, see [i18n.md](./i18n.md)) is **Relics**: a catalog of coins, banknotes,
phonecards and stamps with a list view, an artifact grid, a hover preview, a
detail drawer with a 3D viewer, and a texture editor that exports texture
files.

Implemented from the Claude Design project `Archive Index.dc.html` (plus the
`Artifact.dc.html` component it imports). The design's template runtime
(`support.js`, `sc-if`/`sc-for`/`dc-import`) is not used; everything was
rewritten as React + Tailwind.

## Files

- `features/archive/catalog.ts` — `CatalogItem` discriminated union (one
  variant per `ArtifactKind`; every item carries `model` and `faces` from
  its relic), labels, condition rank/names, `KINDS`, `kindGeometry(kind)`
  (per-kind base mesh), `itemSubtitle(item)`. The data itself lives in
  `relics/*.relic`, see [relic.md](./relic.md).
- `features/archive/relic/` — `.relic` codec (`relic-file.ts`), manifest
  validation (`manifest.ts`), server loader (`load-catalog.ts`).
  `app/[lang]/page.tsx` awaits `loadCatalog()` and passes `catalog` to
  `ArchiveIndex`; `app/relics/[id]/[face]/route.ts` serves textures.
- `features/archive/columns.ts` — per-domain list columns (`COLUMNS`), cell
  type → class map, min table widths, drawer spec rows (`specRows`).
- `features/archive/query.ts` — filter/search/sort (`queryCatalog`) and
  domain counts, both taking the catalog list as their first argument.
- `features/archive/archive-index.tsx` — client component that owns all
  index state (including the texture editor draft) and the keyboard
  handler. Props mirror the design's tweakables:
  `defaultView` (`"grid"`), `rowDensity`, `orbitRpm`, `dwell`. Both
  headers' view toggles list Grid first, matching the default.
- `features/archive/use-relic-history.ts` — `useRelicHistory`, keeps the
  open detail in the URL and history (see **Share links** below).
- `features/archive/use-index-params.ts` — `useIndexParams`, mirrors
  domain tab, sort, direction, search and view into the query string (see
  **Index URL state** below).
- `app/[lang]/relics/[id]/page.tsx` + `opengraph-image.tsx` — per-relic share page
  and its preview card (see **Share links**).
- `header.tsx`, `list-view.tsx`, `grid-view.tsx`, `hover-preview.tsx`,
  `artifact-caption.tsx`, `silhouette.tsx`, `detail-drawer.tsx` — the views.
- `compact-header.tsx`, `domain-tab-bar.tsx`, `domain-glyph.tsx` — phone-only
  chrome (see [Mobile](#mobile-compact-layout)).
- `features/archive/texture-editor/` — modal (`texture-editor.tsx`), 2D
  face editor (`face-editor.tsx`), field schema (`schema.ts`), image
  ingest, 600 dpi template export, relic open/download (`texture-file.ts`).
  `ArchiveIndex` loads the modal with `next/dynamic` and mounts it only
  while open, so its code (and the codec, ingest and template export it
  pulls in) is a separate chunk fetched on first open, not part of the
  index's initial JS. The draft state stays in `ArchiveIndex`, so
  `TextureDraft` and `blankTexture` live in the dependency-free
  `texture-draft.ts`; importing them from `texture-file.ts` would drag the
  editor code back into the initial bundle.
- `features/archive/relic-editor/` + `app/[lang]/relics/[id]/edit/page.dev.tsx`,
  `app/[lang]/relics/[id]/clone/page.dev.tsx`,
  `app/[lang]/relics/new/page.dev.tsx` — dev-only relic editor, see
  [Relic editor](#relic-editor-dev-only).
- `features/archive/artifact-config.ts` — `ArtifactModel` (mesh, fits),
  `ArtifactConfig` (model + face images), `blankConfig(geo)`,
  `relicAssetUrl(id, face, version)` (versioned texture URL, see
  [relic.md](./relic.md)), and `artifactProps(item, config?)` which maps
  an item to `<Artifact>` props (the item's relic model and texture URLs
  when no config is given).
- `components/artifact/` — the reusable 3D `Artifact` viewer (see below).

## Behavior rules

- **Search** matches id, title, origin, ISO, year, kind label, condition and
  the kind's currency/mint/issuer/series fields, case-insensitive.
- **Sort**: clicking the active sort flips direction; a new sort resets to
  ascending. Ties always fall back to catalog id. Items with an unknown
  year sort after every dated item in both directions. `origin` sorts by ISO code;
  `cond` sorts by `CONDITION_RANK` (best grade first).
- **Amount**: when an item's `amount` is above 1, both list layouts show
  `<n>x` right before the thumbnail (`amountLabel`); the slot is always
  reserved so thumbnails stay aligned. The drawer lists it as `Quantity`.
  Spec values of `"—"` render without their unit (`withUnit` in
  `columns.ts`).
- **List columns** change per domain tab. Column headers with a sort key are
  buttons and show the arrow.
- **Grid rendering**: a full CSS-3D rig is hundreds of preserve-3d nodes
  (a note is 11 strips x 2 face windows, a coin 40 rim segments), and the
  grid used to mount one per relic (~20k nodes, ~600ms to switch views,
  janky scroll). Three things keep it cheap now:
  - Each card renders its `Artifact` in `flat` mode: the front face only,
    in the same resting pose, about a dozen nodes.
  - Hovering a card (desktop with fine hover, `tilt` prop on `GridView`)
    swaps that one card to `tilt`, the full rig. On leave it stays 3D for
    `SETTLE_MS` (700ms) so the tilt spring can return to rest before it
    flips back to flat. Phones never leave `flat`.
  - A card mounts its `Artifact` only while its stage is within 600px
    (vertically) of the viewport (`useInView`); off-screen cards keep their
    box and caption. The first `EAGER_CARDS` (12) cards of the current list
    start in view (`useInView`'s `initial`), so their `Artifact` is in the
    prerendered HTML and the browser finds their images before hydration.
    Those cards wrap the `Artifact` in `EagerImages` (context in
    `surfaces.tsx`), which turns `FittedImage` to `loading="eager"` +
    `fetchPriority="high"`; every other face image is `loading="lazy"`.
    Only items with scans emit an `<img>`, so a first row without scans
    prerenders placeholders only. Cards are `memo`ed and get a stable `onOpen` (latest
    handler kept in a ref), so `ArchiveIndex` state changes (drawer
    spin/zoom/flip, hover) do not re-render the grid.
- **Hover preview** appears after `dwell` ms (default 300) and is suppressed
  while the drawer is open. Any scroll (capture phase) hides it. It flips to
  the cursor's left when it would overflow the viewport.
- **Drawer keyboard** (only while open and the texture editor is closed):
  `Esc` close, arrows prev/next (wrap around the *filtered* list), `F`
  flip, `Space` pause/resume orbit. Keys are ignored while focus is in an
  input, except `Esc`.
- **Scroll lock**: `ArchiveIndex` calls `useScrollLock(open)`, so the
  index behind the drawer cannot scroll while the drawer is open (desktop
  and phone). The drawer body scrolls on its own (`overscroll-contain`).
- **Backdrop**: a fixed `bg-ink/16` scrim (same tint as the texture
  editor's) fades in behind the drawer on desktop and phone; tapping it
  closes the drawer.
- **Drawer header height** must match the desktop `Header` so their bottom
  borders line up: both use `py-3.5` around a 30px row (the header's
  tallest controls are the `lg` segmented controls and the 30px search
  input; the drawer's id cell is pinned to `h-[30px]` because its buttons
  are only 28px). Change one, change the other.
- **Search on Google**: an outline link under the drawer's spec rows (both
  layouts) opens a Google search in a new tab. `itemSearchUrl(item, dict)`
  (`catalog.ts`) builds the query as `<kind> <title> <face>` with the kind
  in the active locale (`dict.kind`, e.g. `Stamp` / `Selo`), empty parts
  dropped: PHI-S-0014 → `Stamp Peace Type (Paix), dark blue 65c`.
- **Share links**: the open detail lives at `/<lang>/relics/<id>`
  (`relicPagePath(locale, id)` in `artifact-config.ts`), so the address
  bar is always a shareable link.
  - `app/[lang]/relics/[id]/page.tsx` renders the same `ArchiveIndex` with
    `relicId`; `generateStaticParams` prerenders every catalog id. The
    drawer opens in a mount effect, not on the server, because its layout
    depends on `compact` (JS), which is `false` on the server; a shared
    link paints the index and the drawer slides in after hydration.
    Unknown ids call `notFound()`. With `cacheComponents` and
    `partialPrefetching` the static shell is already streaming, so that
    response is a 200 with the not-found UI and `noindex`, not a 404;
    `dynamicParams = false` is not allowed under `cacheComponents`.
  - **History**: opening from the closed index `pushState`s
    `{ relicDrawer: true }`; stepping prev/next `replaceState`s. Closing
    (Esc, Close, scrim, back button, edge swipe) calls `history.back()` when
    the current entry was pushed by us, otherwise (landed on a shared link)
    `replaceState`s to `/<lang>`. A `popstate` listener maps the path back to
    state: a known `/<lang>/relics/<id>` opens that relic, anything else closes.
    So Back closes the drawer, Forward reopens it, and Back from a landing
    link leaves the site. The relic id is in the path; domain, search,
    sort and view ride along in the query string (see **Index URL
    state**) because every history call keeps `location.search`. Side
    and zoom are not in the URL.
  - **Next history patch gotcha**: Next wraps `pushState`/`replaceState`
    to copy its `__NA`/tree state and sync `usePathname`. It skips that
    sync when the data object already carries `__NA`, so always pass a
    fresh object (never `history.state`). Every entry carries the landing
    page's router tree, so traversing between `/<lang>` and
    `/<lang>/relics/<id>`
    never remounts `ArchiveIndex`.
  - **Metadata**: `generateMetadata` sets title
    (`<title> · <id> · Relics`), `itemSummary` as description
    (localized), `canonical` + hreflang alternates, Open Graph (with
    `locale`) and `summary_large_image` Twitter tags. `metadataBase` in
    `app/[lang]/layout.tsx` is the production origin
    (`https://relics.pmqueiroz.dev`), so image URLs are absolute
    there; change it if the domain moves.
  - **Preview card** (`opengraph-image.tsx`, 1200×630 PNG, prerendered per
    id), laid out per the brand sheet ([brand.md](./brand.md)): tray panel
    on the left with the face image (obverse, else reverse) and the kind
    label; id, title, four spec rows and the lockup on the right. The rows
    come from `specEntries` (`columns.ts`, the same source as the drawer's
    `specRows`), picked per kind by `SHARE_ROWS`: origin, year, one
    kind-defining field (metal, printer, issuer, printing), condition. Long
    values ellipsize. Without a face image it draws a flat per-kind
    silhouette. Face loading and the silhouette live in
    `features/archive/og/face.tsx`, shared with the index card. Satori's
    resvg does not paint WebP (it parses the size, then renders blank), so
    the asset is converted to PNG with `sharp` (explicit dependency, pinned
    to Next's version) first. The raw asset is shown with `contain`, not the
    item's `fit`, so a two-sided scan shows both sides.
  - **Index card** (`app/[lang]/opengraph-image.tsx`, one per locale):
    lockup, the localized domain names as the headline, record count /
    non-empty domain count / year span (`dict.share`), and a 2×2 tile per
    kind showing the first item with a face scan (silhouette otherwise) and
    its count. Inherited by `/<lang>` only; relic pages override it.
- **Index URL state**: `useIndexParams` keeps the index controls in the
  query string, on `/<lang>` and `/<lang>/relics/<id>` alike: `tab`
  (domain), `sort`, `dir` (`asc`/`desc`), `q` (search) and `view`
  (`grid`/`list`). Values equal to the default are omitted, so a pristine
  index has no query string; unknown values fall back to the default.
  - **Read**: in a mount effect, not on the server. Reading search params
    during render (`useSearchParams`) would push the prerendered index
    behind a client-only Suspense boundary, so the static shell paints the
    defaults and a link with params switches after hydration. It re-reads
    on `popstate` too.
  - **Write**: `replaceState` (via `replaceSearch` in
    `use-relic-history.ts`, which keeps the `relicDrawer` flag), never
    `pushState`, so control changes do not add history entries. Writes are
    debounced 250ms: typing in search would otherwise call
    `replaceState` per keystroke, and Safari throws after ~100 calls in
    30s. The write effect waits for the first read (`loaded`), or the
    default state would wipe the incoming params.
  - The locale switch already carries `location.search`, so changing
    language keeps the index state.
- **Zoom**: buttons step ±0.2, wheel steps ±0.1 per 40px of delta, clamped
  to 0.6–2.4.
- **Texture editor** is opened from the header ("Texture editor" on
  desktop, "Editor" on phones), not from an item. See
  [Texture editor](#texture-editor).

## Mobile (compact layout)

Below 720px the index switches to an iOS-style layout taken from the same
design file (`isCompact` there). The breakpoint is the Tailwind
`regular:` variant (`--breakpoint-regular: 720px` in `globals.css`); the
texture editor also uses `split:` (900px) to decide one vs two columns.

How it is split between CSS and JS:

- **Static chrome is CSS-only** so the prerendered page is right on first
  paint: `Header` is `hidden regular:block`, `CompactHeader` is
  `regular:hidden`, `ListView` renders both the table and the compact row
  list and hides one, the grid/empty state use responsive classes, and the
  tab bar is `regular:hidden`.
- **Behavior uses `useMediaQuery`** (`components/ui/use-media-query.ts`,
  `useSyncExternalStore` over `matchMedia`, server snapshot `false`).
  `ArchiveIndex` reads `COMPACT_QUERY` and `FINE_HOVER_QUERY` and passes
  `compact` to `DetailDrawer` and `TextureEditor`. Those two are closed on
  first paint, so the server value never shows.

Compact behavior:

- **Header**: large domain title (`domainTitle`: "Index" for All) + count,
  List/Grid toggle, an "Editor" button for the texture editor, 16px search input (no iOS focus zoom), a native
  `<select>` overlaid invisibly on the Sort label, a direction toggle, and a
  language tile (same overlaid-`<select>` trick, see [i18n.md](./i18n.md)).
  Picking a sort from the select resets direction to ascending.
- **Bottom tab bar** replaces the domain tabs. Tapping the active domain
  scrolls to top. Lists get bottom padding of tab-bar height + safe area.
- **List** rows are 64px tap targets (silhouette tile, id, title,
  subtitle, chevron). **Grid** is two columns with `flat` artifacts (no
  tilt on touch).
- **Hover preview** never shows when compact or when the device lacks
  `(hover: hover) and (pointer: fine)`.
- **Detail** is a full-width pushed page: the index shifts left 28% under
  it, header has a back button labelled with the domain title, the viewer
  controls become 40px tiles, and a footer
  holds Prev / position / Next. Swiping right from the left 18px edge drags
  the page; releasing past 30% width or 140px dismisses it. The aside is
  `touch-pan-y` so horizontal moves reach the pointer handlers.
- **Texture editor** is a bottom sheet (12px top radius, enters from below
  via `starting:`), Close / Download in the sheet header with the kind
  picker under it, scrim tap closes. Range rows grow to 48px with 16px
  number inputs; footer buttons use `size="adaptive"`. The face editor
  measures its section and caps the template at `width - 76px` so it fits
  narrow screens.
- **Safe areas**: `viewport-fit=cover` is set in `app/[lang]/layout.tsx`; headers
  use `pt-safe`, the tab bar, drawer footer and sheet footer use `pb-safe`.

Entry animations use Tailwind `starting:` (`@starting-style`), so the
texture editor animates in but not out (it unmounts on close).

## Texture editor

Textures live in the repo as `.relic` files (see [relic.md](./relic.md)),
so the editor does not save anything locally. It opens a relic, edits its
mesh and faces, and downloads the result as a `.relic` to commit.

- **Kind picker** (Coin / Banknote / Phonecard / Stamp) sits in the modal
  header. Switching kind resets the mesh to `kindGeometry(kind)` and keeps
  both face images and fits. The picker is **disabled** while the draft
  belongs to a catalog entry (`meta.id` set), because that entry's `specs`
  only fit its own kind.
- **Draft** lives in `ArchiveIndex` state, not in the modal, so closing
  the editor (`Esc`, Close, scrim) and reopening keeps the work. It is lost
  on page reload. Starts as `blankTexture("coin")`. `TextureDraft` is
  `ArtifactConfig` + `kind` + `meta` (every manifest field except `kind`,
  `model` and `assets`, carried through untouched).
- **Faces**: per side upload / drag-drop an image, pan by dragging, scale
  by wheel, or use the Fit sliders. Images are downscaled to 1024px on the
  long edge and re-encoded as WebP at quality 0.75 (textures don't need
  more); the canvas re-encode also drops EXIF/GPS/ICC metadata. The image keeps
  its own aspect ratio, so a scan holding both sides can be panned to one
  half per face (see **Face images** under [Artifact viewer](#artifact-viewer-componentsartifact)); only the visible part
  of each is saved (see **Crop on save**). "Template ↓"
  exports a 600 dpi PNG print/scan template for the current side and mesh.
- **WebP required**: there is no PNG/JPEG fallback. On mount the editor
  probes `canEncodeWebp()` (1×1 canvas `toDataURL("image/webp")`); when the
  browser can't encode WebP the whole editor body, footer and the compact
  Download button are replaced by a notice (`editor.webpUnsupported`) telling
  the user to switch to Chrome, Edge or Firefox. `ingestImage` also throws
  if WebP comes back as anything else.
- **Crop on save**: the draft keeps the full uploaded image so it can be
  re-panned, but `encodeTexture` (Download and the relic editor's Save)
  bakes each face with `cropToFace` (`ingest-image.ts`): the image is drawn
  through its fit (same cover size, translate/rotate/scale as
  `fitTransform`) onto a canvas with the face's aspect
  (`templateDimensions`), at the source's own pixel density capped at
  1024px on the long edge, re-encoded as WebP 0.75. The manifest then gets
  `DEFAULT_FIT` for both faces, so the viewer shows the same thing from a
  smaller file. Areas the image does not cover (rotation, pan past the
  edge) stay transparent and show the face `backing`. A face that is
  already baked (default fit, aspect within 1%) is kept byte-for-byte, so
  re-saving does not re-encode it. Cropping both faces out of one
  side-by-side scan gives two different images, so the shared-bytes
  dedupe no longer applies to it.
- **Mesh defaults** resets only the mesh; **Clear** resets the whole draft
  for the current kind, `meta` included (detaches it from its entry).
- **Open…** reads a `.relic`: asset bytes become in-memory data URLs so the
  face editor and template export work unchanged. Decode errors show in the
  status bar as `<file> · <reason>`.
- **Download** (the primary action unless a `save` prop overrides it)
  writes `<id>.relic` (or `<kind>.relic` for a blank draft):
  data URLs go back to raw bytes, manifest is `meta` + `kind` + `model`.
- The preview passes empty `face`/`year`/`origin` and the kind name as
  `code`, so faces without an image show a blank "scan" placeholder.

There is no auth. The cookie session that gated local saves was removed
with local storage; add a real write guard when an upload endpoint exists.

`encodeTexture(draft)` and `textureFromRelic(contents, toDataUrl)` in
`texture-file.ts` are the shared halves of download/open; the relic editor
uses them too.

## Relic editor (dev only)

Edits a `.relic` file's catalog fields and writes it to `relics/` from the
browser. It only exists under `next dev`; production builds contain neither
the routes nor the buttons (see
[conventions.md](./conventions.md#dev-only-code)).

- **Entry points** (yellow `DevLink`s): **Clone** and **Edit** in the
  detail drawer header (desktop before Prev; phone at the right of the id)
  → `/<lang>/relics/<id>/clone` and `/<lang>/relics/<id>/edit`; **+ New entry** in the desktop header and a
  `+` tile in the compact header → `/<lang>/relics/new`.
- **Index state round-trip**: the editor pages keep the index query string
  (see **Index URL state**) so Back and Save land on the same tab, sort,
  search and view. `DevLink` is built on `SearchLink`
  (`components/ui/search-link.tsx`), which appends the *current*
  `location.search` at click time: the index writes the query with
  `replaceState`, which Next's router does not see, so the `href` rendered
  from props would be stale. A plain left click is intercepted and pushed
  through the router; modified and middle clicks get the `href` rewritten
  on the anchor so a new tab carries the query too. The editor's **Back**
  is a `SearchLink` as well, and Save pushes
  `withCurrentSearch(relicPagePath(…))`. A control change made less than
  250ms before clicking (the write debounce) is not carried.
- **Routes**: `app/[lang]/relics/[id]/edit/page.dev.tsx` (unknown id →
  `notFound()`; `instant = false`, since it reads `params` outside
  `Suspense` and a blocking dev page is fine),
  `app/[lang]/relics/[id]/clone/page.dev.tsx` (same guards) and
  `app/[lang]/relics/new/page.dev.tsx`. The static `new` segment wins over
  `[id]`; in production `/…/relics/new` falls through to `[id]` and 404s.
- **Draft**: the same `TextureDraft` the texture editor uses.
  `loadRelicDraft(id)` (`relic-store.ts`, `'use cache'`, tagged) turns the
  relic into a draft with base64 data URLs on the server. A new entry
  starts from `blankEntry(kind, id)` (`entry-draft.ts`): empty text fields,
  unknown year, amount 1, `VF`, every spec `"—"`. A clone
  starts from the source's full draft (fields, faces, mesh) with `meta.id`
  swapped for that kind's `nextIds` suggestion; it is a new entry
  (`previousId: null`, kind unlocked) with `cloneOf` set, which only titles
  the page "Clone <id>" and points Back at the source relic.
- **Form** (`relic-editor.tsx`): kind (locked when editing an existing
  entry), `id`, `title`, `origin`, `iso`, `face`, year (empty = unknown),
  amount, condition, and the kind's `SPEC_FIELDS`. Labels are the
  manifest keys. On a new entry, switching kind swaps specs to the new
  kind's fields (keeping matching values) and, when the id is empty or
  still the suggestion, replaces it with that kind's suggestion
  (`nextIds`: highest trailing number among that kind's ids + 1, same
  prefix and padding; a kind with no entries yet starts at its
  `FIRST_IDS` seed: `NUM-C-0001` coin, `NUM-B-0001` note, `TEL-C-0001`
  card, `PHI-S-0001` stamp).
- **Textures and mesh**: the preview is a live `Artifact` of the draft;
  "Texture editor…" opens the existing `TextureEditor` modal on the same
  draft. Its updates are applied with the editor's `meta` kept, so its
  **Clear** and **Open…** change faces/mesh but never wipe the form.
  The modal gets a `save` prop (`{ label, run }`), which replaces its
  primary **Download** button (footer and compact sheet header) with
  **Save**: it closes the modal and runs the page's save below.
- **Save** (button or Ctrl/⌘+S): `encodeTexture` → `FormData` →
  `saveRelic` Server Action (`save-relic.ts`). The action refuses outside
  development, decodes and validates with the strict `parseCatalogEntry`
  (its error message is shown in the status), requires an id matching
  `^[A-Za-z0-9][A-Za-z0-9._-]*$` (it becomes a file name), refuses an id
  that already belongs to another entry, re-encodes new scans with
  `sharp` (see **Server re-encode** in [relic.md](./relic.md#manifest)),
  writes `relics/<id>.relic`, deletes the old file when the id was changed, and calls
  `updateTag("relics")`. The client then pushes to the relic's share page, keeping the query string.
- **Activity**: with Cache Components, Next keeps visited pages mounted
  but hidden. The form is keyed on `useRouter().bfcacheId`, so a link or
  push navigation always starts from the file on disk, while browser
  Back/Forward keeps an unsaved draft.

## Artifact viewer (`components/artifact/`)

A CSS-3D rig (no WebGL). `artifact.tsx` owns motion; `coin.tsx`,
`note.tsx`, `card.tsx`, `stamp.tsx` build the meshes; `surfaces.tsx` holds
shared face layers (sheen, image). Geometry is in millimetres and
scaled into a 240px rig.

- **Modes**: `flat` (static pose, mesh draws only its front face: no coin
  rim, card edge layers, note strips or back faces; used by the grid);
  `static`; `tilt` (pointer-follow, spring 170/13, ±12°);
  `orbit` (auto-rotate at `rpm`, drag to rotate with X clamped ±70°, wheel
  calls `onZoom`, two-finger pinch calls `onZoom(±1)` each time the finger
  span changes by ~10%, spring-animated flip and zoom).
- **Sway kinds**: kinds in `SWAY_AMPLITUDE` (`artifact.tsx`; only `stamp`,
  ±60°) never auto-rotate a full turn, so the reverse is never shown unless
  reached manually (drag or the Obv/Rev flip). Their auto-orbit is
  `amplitude · sin(phase)` with `phase += rpm·6 / amplitude · dt`, so the
  peak angular speed equals the normal `rpm` speed. The sway is added to
  drag and flip, so it rocks around whichever side the user left facing;
  with the −15°/15° base pose the front stays within −45°…75°. Pausing keeps
  the phase; `resetKey` zeroes it.
- Motion runs in a single `requestAnimationFrame` loop that stops when
  settled; props are read through a ref so the loop never re-subscribes.
  Changing `resetKey` zeroes orbit/drag and snaps the flip.
- Face variants per side: uploaded image, otherwise the "scan" placeholder
  (drawn from `face`, `code`, `year`, `origin`). Each mesh keeps its
  placeholder as `ObverseScan`/`ReverseScan` (`FrontScan`/`BackScan` on
  notes), with a `loading` flag.
- **Loading variant**: `FaceImage` takes a `placeholder(loading)` render
  prop. Until the image's `onLoad`, it draws the placeholder with
  `loading` set (label reads `LOADING` via `scanLabel`) plus a light
  sweep (`animate-scan-sweep`, `motion-safe` only, a transformed gradient so
  it stays on the compositor). The `<img>` sits on top the whole time
  instead of fading in. Next fires `onLoad` only after `decode()`
  resolves, so hiding the image until then would flash the loading
  placeholder for a frame on cached images. On load the placeholder is
  swapped for the plain `backing` colour. If the image errors it is
  dropped and the normal scan placeholder stays. There is no untextured
  clay variant. Older `.relic` manifests may still carry a `tex` boolean;
  the parser ignores it and the editor carries it through on save.
- **Face images** (`FittedImage` in `surfaces.tsx`, also used by the
  texture editor's face editor): a face-sized wrapper carries the
  `fitTransform` (translate % of the face, rotate, scale), and the image
  inside it is sized to *cover* the face at its natural aspect ratio but is
  not clipped by `object-fit`. Only the face's own `overflow-hidden`
  clips, so pan/scale can reach any part of the image (e.g. one coin of a
  side-by-side scan). Sizing uses container query units
  (`container-type: size` on the wrapper) and the natural aspect read in
  `onLoad`; until it loads the image falls back to plain `object-cover`.
  The cover size goes on an inner `div`, never on the `next/image`
  itself: a `fill` image rejects `style.width` (runtime error), so the
  image just fills that sized `div`.
  Fit offsets range ±200%. At the image's default fit, a face whose image
  matches the face aspect renders exactly as before.
- `fit` sets the scale divisor: the rig scales to
  `min(width, height) / fit`.
- Banknotes are 11 strips bent along a parabola (`curve` mm). Stamps use a
  CSS mask for die-cut perforation; the same mask math
  (`perforationGrid`/`perforationMask` in `geometry.ts`) drives the
  texture editor preview and the PNG template so all three agree.
