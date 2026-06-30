import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { employeeStaticApi } from "../api/employee-static.api";

export function EmployeeStaticPageView() {
  const { slug } = useParams<{ slug: string }>();
  const query = useQuery({
    queryKey: ["employee-static", "page", slug],
    queryFn: () => employeeStaticApi.getPage(slug!),
    enabled: Boolean(slug)
  });

  if (!slug) return <p className="feedback error">Pagină invalidă.</p>;
  if (query.isLoading) return <p className="field-hint">Se încarcă…</p>;
  if (query.isError || !query.data) return <p className="feedback error">Pagina nu a fost găsită.</p>;

  return (
    <div className="page-stack">
      <header className="page-header">
        <Link to="/informatii" className="btn-text-link">
          ← Înapoi la informații
        </Link>
        <h1>{query.data.title}</h1>
      </header>
      <article className="card employee-static-body">
        <div style={{ whiteSpace: "pre-wrap" }}>{query.data.bodyMarkdown}</div>
        {query.data.attachmentName ? (
          <p className="field-hint">Document atașat: {query.data.attachmentName}</p>
        ) : null}
      </article>
    </div>
  );
}
