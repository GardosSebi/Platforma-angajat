import { useEffect, useState } from "react";
import { isCommsUploadedMedia } from "@repo/shared-types/communications";
import { fetchBlobWithAuth } from "../../../shared/api/http-download";
import { chatbotApi } from "../api/chatbot.api";

type Props = {
  contentUrl?: string | null;
  contentType?: string;
  className?: string;
  alt?: string;
};

export function CommsMediaPreview({ contentUrl, contentType, className, alt = "" }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const uploaded = isCommsUploadedMedia(contentUrl);
  const external = Boolean(contentUrl && !uploaded);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    if (!contentUrl || !uploaded) {
      setObjectUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    void fetchBlobWithAuth(chatbotApi.mediaStreamPath(contentUrl))
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoked = url;
        setObjectUrl(url);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Nu s-a putut încărca fișierul.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [contentUrl, uploaded]);

  if (!contentUrl) return null;

  const src = uploaded ? objectUrl : contentUrl;
  const isImage = contentType === "IMAGE" || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(contentUrl);
  const isVideo = contentType === "VIDEO" || /\.(mp4|webm|ogg)(\?|$)/i.test(contentUrl);

  if (uploaded && loading) {
    return <p className="field-hint">Se încarcă media…</p>;
  }
  if (uploaded && error) {
    return <p className="feedback error">{error}</p>;
  }

  if (isImage && src) {
    return <img src={src} alt={alt} className={className ?? "employee-announcement-media"} />;
  }
  if (isVideo && src) {
    return <video src={src} controls className={className ?? "employee-announcement-media"} />;
  }

  if (external) {
    return (
      <p>
        <a href={contentUrl} target="_blank" rel="noreferrer" className="btn-text-link">
          Deschide atașamentul
        </a>
      </p>
    );
  }

  if (objectUrl) {
    return (
      <p>
        <a href={objectUrl} download className="btn-text-link">
          Descarcă fișierul
        </a>
      </p>
    );
  }

  return null;
}
