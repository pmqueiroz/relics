"use client";

import dynamic from "next/dynamic";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { cx } from "../../components/ui/cx";
import {
  COMPACT_QUERY,
  FINE_HOVER_QUERY,
  useMediaQuery,
} from "../../components/ui/use-media-query";
import { useScrollLock } from "../../components/ui/use-scroll-lock";
import { useDictionary } from "../../i18n/locale-provider";
import {
  type CatalogItem,
  type Domain,
  domainTitle,
  type SortKey,
} from "./catalog";
import { CompactHeader } from "./compact-header";
import { DetailDrawer, ZOOM_MAX, ZOOM_MIN } from "./detail-drawer";
import { DomainTabBar } from "./domain-tab-bar";
import { GridView } from "./grid-view";
import { Header, type View } from "./header";
import { HoverPreview, type PreviewPosition } from "./hover-preview";
import { ListView } from "./list-view";
import { domainCounts, queryCatalog, type SortDirection } from "./query";
import { blankTexture } from "./texture-editor/texture-draft";
import { useIndexParams } from "./use-index-params";
import { useRelicHistory } from "./use-relic-history";

type ArchiveIndexProps = {
  catalog: CatalogItem[];
  relicId?: string;
  defaultView?: View;
  rowDensity?: "compact" | "regular";
  orbitRpm?: number;
  dwell?: number;
};

const TextureEditor = dynamic(() =>
  import("./texture-editor/texture-editor").then(
    (module) => module.TextureEditor,
  ),
);

const PREVIEW_WIDTH = 290;
const PREVIEW_HEIGHT = 310;

export function ArchiveIndex({
  catalog,
  relicId,
  defaultView = "grid",
  rowDensity = "compact",
  orbitRpm = 2,
  dwell = 300,
}: ArchiveIndexProps) {
  const [domain, setDomain] = useState<Domain>("all");
  const [sort, setSort] = useState<SortKey>("id");
  const [direction, setDirection] = useState<SortDirection>(1);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>(defaultView);
  const [preview, setPreview] = useState<PreviewPosition | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(relicId ?? null);
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [resetKey, setResetKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [texture, setTexture] = useState(() => blankTexture("coin"));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const compact = useMediaQuery(COMPACT_QUERY);
  const fineHover = useMediaQuery(FINE_HOVER_QUERY, true);
  const dict = useDictionary();
  useScrollLock(open);
  useIndexParams(
    { domain, sort, direction, query, view },
    defaultView,
    (params) => {
      setDomain(params.domain);
      setSort(params.sort);
      setDirection(params.direction);
      setQuery(params.query);
      setView(params.view);
    },
  );

  const counts = useMemo(() => domainCounts(catalog), [catalog]);
  const items = useMemo(
    () => queryCatalog(catalog, domain, sort, direction, query, dict.kind),
    [catalog, domain, sort, direction, query, dict],
  );
  const selected =
    catalog.find((item) => item.id === selectedId) ?? items[0] ?? catalog[0];
  const previewItem = preview
    ? catalog.find((item) => item.id === preview.id)
    : undefined;

  const unhover = () => {
    clearTimeout(timer.current);
    setPreview(null);
  };

  const onHover = (id: string, event: MouseEvent) => {
    const { clientX, clientY } = event;
    setPreview(null);
    clearTimeout(timer.current);
    if (open || compact || !fineHover) return;
    timer.current = setTimeout(() => {
      let x = clientX + 20;
      if (x + PREVIEW_WIDTH > window.innerWidth) x = clientX - 300;
      const y = Math.max(
        8,
        Math.min(window.innerHeight - PREVIEW_HEIGHT, clientY - 40),
      );
      setPreview({ id, x: Math.max(8, x), y });
    }, dwell);
  };

  const showItem = (id: string) => {
    clearTimeout(timer.current);
    setPreview(null);
    setSelectedId(id);
    setOpen(true);
    setFlipped(false);
    setZoom(1);
    setSpinning(true);
    setResetKey((key) => key + 1);
  };

  const history = useRelicHistory((id) => {
    if (id && catalog.some((item) => item.id === id)) showItem(id);
    else setOpen(false);
  });

  const openItem = (id: string) => {
    if (open) history.show(id);
    else history.open(id);
    showItem(id);
  };

  const closeDetail = () => {
    setOpen(false);
    history.close();
  };

  useEffect(() => {
    if (relicId) setOpen(true);
  }, [relicId]);

  const step = (offset: number) => {
    if (!items.length) return;
    const index = items.findIndex((item) => item.id === selected.id);
    const next =
      items[((index < 0 ? 0 : index + offset) + items.length) % items.length];
    setSelectedId(next.id);
    history.show(next.id);
    setFlipped(false);
    setResetKey((key) => key + 1);
  };

  const onSort = (key: SortKey) => {
    if (key === sort) setDirection((current) => (current > 0 ? -1 : 1));
    else {
      setSort(key);
      setDirection(1);
    }
  };

  const onDomain = (next: Domain) => {
    if (next === domain) window.scrollTo({ top: 0, behavior: "smooth" });
    setDomain(next);
  };

  const onSortKey = (key: SortKey) => {
    setSort(key);
    setDirection(1);
  };

  const changeZoom = (delta: number) =>
    setZoom((current) =>
      Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +(current + delta).toFixed(2))),
    );

  const openTextureEditor = () => {
    unhover();
    setEditing(true);
  };

  const keys = useRef({ open, editing, step, closeDetail });
  keys.current = { open, editing, step, closeDetail };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = keys.current;
      if (!state.open || state.editing) return;
      const target = event.target as HTMLElement | null;
      if (event.key === "Escape") state.closeDetail();
      else if (target?.tagName === "INPUT") return;
      else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        state.step(1);
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        state.step(-1);
      } else if (event.key === "f" || event.key === "F")
        setFlipped((value) => !value);
      else if (event.key === " ") {
        event.preventDefault();
        setSpinning((value) => !value);
      }
    };
    const onScroll = () => {
      clearTimeout(timer.current);
      setPreview(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  const selectedIndex = items.findIndex((item) => item.id === selected.id);
  const pageShift = compact && open ? "-translate-x-[28%]" : "";
  const onView = (next: View) => {
    if (next === "grid") unhover();
    setView(next);
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div
        className={cx(
          "min-h-screen transition-transform duration-450 ease-drawer",
          pageShift,
        )}
      >
        <CompactHeader
          domain={domain}
          shown={items.length}
          view={view}
          onView={onView}
          query={query}
          onQuery={setQuery}
          sort={sort}
          direction={direction}
          onSortKey={onSortKey}
          onToggleDirection={() =>
            setDirection((current) => (current > 0 ? -1 : 1))
          }
          onTextureEditor={openTextureEditor}
        />
        <Header
          shown={items.length}
          total={catalog.length}
          domain={domain}
          counts={counts}
          onDomain={onDomain}
          sort={sort}
          direction={direction}
          onSort={onSort}
          query={query}
          onQuery={setQuery}
          view={view}
          onView={onView}
          onTextureEditor={openTextureEditor}
        />

        {items.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-4 py-12 regular:px-7 regular:py-16">
            <div className="mono text-cell text-faint">
              {dict.empty.noMatch(query)}
            </div>
            <Button size="adaptive" onClick={() => setQuery("")}>
              {dict.empty.clear}
            </Button>
          </div>
        ) : view === "list" ? (
          <ListView
            items={items}
            domain={domain}
            sort={sort}
            direction={direction}
            onSort={onSort}
            selectedId={open ? selected.id : null}
            rowHeight={rowDensity === "regular" ? 52 : 42}
            onOpen={openItem}
            onHover={onHover}
            onUnhover={unhover}
          />
        ) : (
          <GridView
            items={items}
            tilt={!compact && fineHover}
            onOpen={openItem}
          />
        )}
      </div>

      <DomainTabBar
        domain={domain}
        onDomain={onDomain}
        className={cx(
          "transition-transform duration-450 ease-drawer regular:hidden",
          pageShift,
        )}
      />

      {preview && previewItem && (
        <HoverPreview item={previewItem} x={preview.x} y={preview.y} />
      )}

      <DetailDrawer
        open={open}
        compact={compact}
        backLabel={domainTitle(domain, dict)}
        position={`${selectedIndex < 0 ? "–" : selectedIndex + 1} / ${items.length}`}
        item={selected}
        onClose={closeDetail}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        spinning={spinning}
        onToggleSpin={() => setSpinning((value) => !value)}
        flipped={flipped}
        onFlip={setFlipped}
        zoom={zoom}
        onZoom={changeZoom}
        rpm={orbitRpm}
        resetKey={resetKey}
        onReset={() => {
          setZoom(1);
          setFlipped(false);
          setSpinning(true);
          setResetKey((key) => key + 1);
        }}
      />

      {editing && (
        <TextureEditor
          compact={compact}
          draft={texture}
          onDraft={setTexture}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
