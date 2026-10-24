import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Artifact } from "../../components/artifact/artifact";
import { EagerImages } from "../../components/artifact/surfaces";
import { useInView } from "../../components/ui/use-in-view";
import { ArtifactCaption } from "./artifact-caption";
import { artifactProps } from "./artifact-config";
import type { CatalogItem } from "./catalog";

type GridViewProps = {
  items: CatalogItem[];
  tilt: boolean;
  onOpen: (id: string) => void;
};

const MOUNT_MARGIN = "600px 0px";
const SETTLE_MS = 700;
const EAGER_CARDS = 12;

export function GridView({ items, tilt, onOpen }: GridViewProps) {
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const open = useCallback((id: string) => openRef.current(id), []);

  return (
    <main className="grid grid-cols-2 gap-2 p-3 pb-[calc(env(safe-area-inset-bottom)+72px)] regular:grid-cols-[repeat(auto-fill,minmax(232px,1fr))] regular:gap-3 regular:px-7 regular:pb-12 regular:pt-6">
      {items.map((item, index) => (
        <GridCard
          key={item.id}
          item={item}
          tilt={tilt}
          eager={index < EAGER_CARDS}
          onOpen={open}
        />
      ))}
    </main>
  );
}

const GridCard = memo(function GridCard({
  item,
  tilt,
  eager,
  onOpen,
}: {
  item: CatalogItem;
  tilt: boolean;
  eager: boolean;
  onOpen: (id: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, MOUNT_MARGIN, eager);
  const [active, setActive] = useState(false);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(settle.current), []);

  const onEnter = () => {
    clearTimeout(settle.current);
    if (tilt) setActive(true);
  };
  const onLeave = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => setActive(false), SETTLE_MS);
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      className="flex min-w-0 cursor-pointer flex-col rounded-xs bg-surface text-left transition-colors duration-200 hover:bg-raised active:bg-raised"
    >
      <div ref={stageRef} className="relative aspect-[1/0.84] w-full">
        {inView && (
          <EagerImages value={eager}>
            <Artifact
              {...artifactProps(item)}
              mode={tilt && active ? "tilt" : "flat"}
            />
          </EagerImages>
        )}
      </div>
      <ArtifactCaption item={item} truncate fluid />
    </button>
  );
});
