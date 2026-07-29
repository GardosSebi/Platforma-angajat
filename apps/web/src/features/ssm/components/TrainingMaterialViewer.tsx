import { useEffect, useRef, useState } from "react";
import type { SsmTrainingPlanItem } from "@repo/shared-types/ssm";
import { fetchBlobWithAuth } from "../../../shared/api/http-download";
import { ssmApi } from "../api/ssm.api";

type Props = {
  plan: SsmTrainingPlanItem;
  onOpened?: () => void;
};

export function TrainingMaterialViewer({ plan, onOpened }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;

  const hasUpload = Boolean(plan.hasUploadedMaterial);
  const mime = plan.materialMimeType ?? "";

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    if (!hasUpload) {
      setObjectUrl(null);
      return;
    }

    setLoading(true);
    setError(null);
    void fetchBlobWithAuth(ssmApi.getTrainingMaterialUrl(plan.id))
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoked = url;
        setObjectUrl(url);
        onOpenedRef.current?.();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Nu s-a putut încărca materialul.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [hasUpload, plan.id]);

  if (hasUpload) {
    return (
      <div className="ssm-material-viewer">
        <p className="field-hint">
          Material încărcat: <strong>{plan.materialFileName ?? plan.materialTitle ?? "fișier"}</strong>
        </p>
        {loading ? <p className="field-hint">Se încarcă materialul…</p> : null}
        {error ? <p className="feedback error">{error}</p> : null}
        {objectUrl && mime.startsWith("video/") ? (
          <video controls src={objectUrl} className="ssm-material-media" />
        ) : null}
        {objectUrl && mime.includes("pdf") ? (
          <iframe title="Material PDF" src={objectUrl} className="ssm-material-frame" />
        ) : null}
        {objectUrl && !mime.startsWith("video/") && !mime.includes("pdf") ? (
          <p>
            <a href={objectUrl} download={plan.materialFileName ?? "material"} className="btn-text-link">
              Descarcă material Word / fișier
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  if (plan.materialUrl) {
    return (
      <p>
        <a
          href={plan.materialUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-text-link"
          onClick={() => onOpenedRef.current?.()}
        >
          Deschide material: {plan.materialTitle ?? "Instruire"}
        </a>
      </p>
    );
  }

  return <p className="field-hint">{plan.materialTitle ?? "Material instruire"} — fără fișier sau URL.</p>;
}
