import type { ArtifactKind } from "../../../components/artifact/types";
import { type ArtifactConfig, blankConfig } from "../artifact-config";
import { kindGeometry } from "../catalog";

export type TextureDraft = ArtifactConfig & {
  kind: ArtifactKind;
  meta: Record<string, unknown>;
};

export function blankTexture(kind: ArtifactKind): TextureDraft {
  return { kind, meta: {}, ...blankConfig(kindGeometry(kind)) };
}
