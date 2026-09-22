import { useEffect, useState } from "react";
import { isSurveyUploadedImage } from "@repo/shared-types/surveys";
import { fetchBlobWithAuth } from "../../../shared/api/http-download";
import { fetchPublicOptionImage, surveysApi } from "../api/surveys.api";

type Props = {
  imageUrl?: string | null;
  alt: string;
  className?: string;
  /** Public survey token — used to stream uploaded images without JWT. */
  publicToken?: string;
};

export function SurveyOptionImage({ imageUrl, alt, className, publicToken }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploaded = isSurveyUploadedImage(imageUrl);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    if (!imageUrl || !uploaded) {
      setObjectUrl(null);
      setError(null);
      return;
    }

    const load = publicToken
      ? fetchPublicOptionImage(publicToken, imageUrl)
      : fetchBlobWithAuth(surveysApi.optionImageStreamPath(imageUrl));

    void load
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoked = url;
        setObjectUrl(url);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Imaginea nu s-a putut încărca.");
      });

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [imageUrl, uploaded, publicToken]);

  if (!imageUrl) return null;
  if (uploaded && error) {
    return <span className="field-hint">Imagine indisponibilă</span>;
  }
  const src = uploaded ? objectUrl : imageUrl;
  if (!src) return <span className="field-hint">Se încarcă imaginea…</span>;
  return <img src={src} alt={alt} className={className} />;
}
