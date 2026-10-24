import Image from "next/image";
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { cx } from "../ui/cx";
import { fitTransform } from "./geometry";
import type { Fit } from "./types";

export function Sheen({
  strength,
  spread = "58%",
}: {
  strength: number;
  spread?: string;
}) {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(circle at var(--sx, 32%) var(--sy, 26%), rgba(245,244,240,${strength}) 0%, rgba(245,244,240,0) ${spread})`,
      }}
    />
  );
}

export const EagerImages = createContext(false);

type LoadStatus = "loaded" | "failed";

export function scanLabel(loading: boolean, idle = "SCAN") {
  return loading ? "LOADING" : idle;
}

function LoadingSweep() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 motion-safe:animate-scan-sweep"
        style={{
          background:
            "linear-gradient(100deg, rgba(245,244,240,0) 25%, rgba(245,244,240,0.55) 50%, rgba(245,244,240,0) 75%)",
        }}
      />
    </div>
  );
}

export function FaceImage({
  src,
  fit,
  backing,
  placeholder,
}: {
  src: string;
  fit?: Fit;
  backing: string;
  placeholder: (loading: boolean) => ReactNode;
}) {
  const [settled, setSettled] = useState<{ src: string; status: LoadStatus }>();
  const status = settled?.src === src ? settled.status : "loading";

  return (
    <>
      {status === "loaded" ? (
        <div className="absolute inset-0" style={{ background: backing }} />
      ) : (
        <div className="absolute inset-0">
          {placeholder(status === "loading")}
          {status === "loading" && <LoadingSweep />}
        </div>
      )}
      {status !== "failed" && (
        <FittedImage
          src={src}
          fit={fit}
          onLoad={() => setSettled({ src, status: "loaded" })}
          onError={() => setSettled({ src, status: "failed" })}
        />
      )}
    </>
  );
}

function coverSize(aspect: number): CSSProperties {
  return {
    left: "50%",
    top: "50%",
    right: "auto",
    bottom: "auto",
    width: `max(100cqw, ${aspect} * 100cqh)`,
    height: `max(100cqh, 100cqw / ${aspect})`,
    maxWidth: "none",
    translate: "-50% -50%",
  };
}

export function FittedImage({
  src,
  fit,
  className,
  onLoad,
  onError,
}: {
  src: string;
  fit?: Partial<Fit>;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const [natural, setNatural] = useState<{ src: string; aspect: number }>();
  const aspect = natural?.src === src ? natural.aspect : null;
  const eager = useContext(EagerImages);

  return (
    <div
      className={cx("absolute inset-0", className)}
      style={{ containerType: "size", transform: fitTransform(fit) }}
    >
      <div
        className="absolute inset-0"
        style={aspect ? coverSize(aspect) : undefined}
      >
        <Image
          src={src}
          alt=""
          fill
          unoptimized
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          draggable={false}
          className="object-cover"
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth && naturalHeight)
              setNatural({ src, aspect: naturalWidth / naturalHeight });
            onLoad?.();
          }}
          onError={onError}
        />
      </div>
    </div>
  );
}

export function MonoText({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx("font-mono whitespace-nowrap text-muted", className)}
      style={style}
    >
      {children}
    </div>
  );
}
