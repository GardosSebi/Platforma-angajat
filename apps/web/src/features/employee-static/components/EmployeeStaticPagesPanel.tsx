import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { employeeStaticApi } from "../api/employee-static.api";

export function EmployeeStaticPagesPanel() {
  const query = useQuery({
    queryKey: ["employee-static", "pages"],
    queryFn: () => employeeStaticApi.listPages()
  });

  const items = query.data ?? [];

  if (query.isLoading) return <p className="field-hint">Se încarcă paginile…</p>;
  if (!items.length) {
    return (
      <div className="employee-portal-empty card">
        <p>Nu există pagini informative publicate pentru profilul tău.</p>
      </div>
    );
  }

  return (
    <ul className="employee-doc-list">
      {items.map((page) => (
        <li key={page.id} className="card employee-doc-item">
          <div>
            <strong>{page.title}</strong>
            {page.attachmentName ? <p className="field-hint">Atașament: {page.attachmentName}</p> : null}
          </div>
          <Link className="btn-secondary" to={`/informatii/${page.slug}`}>
            Citește
          </Link>
        </li>
      ))}
    </ul>
  );
}
