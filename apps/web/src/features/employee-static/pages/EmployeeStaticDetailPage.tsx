import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { employeeStaticApi } from "../api/employee-static.api";

export function EmployeeStaticDetailPage() {
  const { slug: slugParam } = useParams();
  const [searchParams] = useSearchParams();
  const slug = slugParam ? decodeURIComponent(slugParam) : "";

  const worksiteId = searchParams.get("worksiteId") ?? undefined;
  const groupIds = useMemo(() => {
    const raw = searchParams.get("groupIds");
    if (!raw) return undefined;
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [searchParams]);

  const pageQuery = useQuery({
    queryKey: ["employee-static", "page", slug, worksiteId, groupIds],
    queryFn: () => employeeStaticApi.getPage(slug, worksiteId, groupIds),
    enabled: !!slug
  });

  const err = pageQuery.error instanceof Error ? pageQuery.error.message : null;

  if (!slug) {
    return (
      <div className="page-stack">
        <p>Lipsește slug-ul paginii.</p>
        <Link to="/informatii">Înapoi la listă</Link>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <p className="breadcrumb">
        <Link to={`/informatii${searchParams.toString() ? `?${searchParams.toString()}` : ""}`}>← Listă</Link>
      </p>
      {pageQuery.isLoading ? <p>Se încarcă…</p> : null}
      {err ? (
        <p className="feedback error" role="alert">
          {err}
        </p>
      ) : null}
      {pageQuery.data ? (
        <article className="card static-article">
          <h1>{pageQuery.data.title}</h1>
          <pre className="static-body">{pageQuery.data.bodyMarkdown}</pre>
          {pageQuery.data.attachmentName ? (
            <p className="text-muted small">
              Document atașat: {pageQuery.data.attachmentName}
              {pageQuery.data.attachmentMime ? ` (${pageQuery.data.attachmentMime})` : ""}
            </p>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}
