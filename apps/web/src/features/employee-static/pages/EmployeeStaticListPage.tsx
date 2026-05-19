import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { EmployeeStaticPageListItem } from "@repo/shared-types";
import { useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import { employeeStaticApi } from "../api/employee-static.api";

export function EmployeeStaticListPage() {
  const worksitesLookup = useWorksitesLookup();
  const [worksiteId, setWorksiteId] = useState("");
  const [groupIdsText, setGroupIdsText] = useState("");

  const groupIds = useMemo(
    () =>
      groupIdsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [groupIdsText]
  );

  const querySuffix = useMemo(() => {
    const q = new URLSearchParams();
    if (worksiteId) q.set("worksiteId", worksiteId);
    if (groupIds.length) q.set("groupIds", groupIds.join(","));
    return q.toString() ? `?${q.toString()}` : "";
  }, [worksiteId, groupIds]);

  const pagesQuery = useQuery({
    queryKey: ["employee-static", "pages", worksiteId, groupIds],
    queryFn: () => employeeStaticApi.listPages(worksiteId || undefined, groupIds.length ? groupIds : undefined)
  });

  const err = pagesQuery.error instanceof Error ? pagesQuery.error.message : null;

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1>Informații & documente</h1>
        <p className="page-lead">
          Pagini statice publicate de administrator. Opțional restrânge lista la locația ta (worksite) sau la ID-uri de
          grupuri, separate prin virgulă.
        </p>
      </header>

      <section className="card form-stack">
        <div className="field">
          <label htmlFor="es-worksite">Worksite (opțional)</label>
          <select
            id="es-worksite"
            value={worksiteId}
            onChange={(e) => setWorksiteId(e.target.value)}
            aria-label="Filtru worksite"
          >
            <option value="">Toate</option>
            {(worksitesLookup.data?.items ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="es-groups">ID grupuri (opțional, separate prin virgulă)</label>
          <input
            id="es-groups"
            value={groupIdsText}
            onChange={(e) => setGroupIdsText(e.target.value)}
            placeholder="ex: clxyz123,clabc456"
          />
        </div>
      </section>

      {err ? (
        <p className="feedback error" role="alert">
          {err}
        </p>
      ) : null}

      <section className="card">
        <h2>Pagini disponibile</h2>
        {pagesQuery.isLoading ? <p>Se încarcă…</p> : null}
        {!pagesQuery.isLoading && (pagesQuery.data ?? []).length === 0 ? (
          <p className="text-muted">Nu există pagini publicate pentru filtrele curente.</p>
        ) : null}
        <ul className="static-page-links">
          {(pagesQuery.data ?? []).map((p: EmployeeStaticPageListItem) => (
            <li key={p.id}>
              <Link to={`/informatii/${encodeURIComponent(p.slug)}${querySuffix}`}>{p.title}</Link>
              {p.attachmentName ? (
                <span className="text-muted small"> · fișier atașat: {p.attachmentName}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
