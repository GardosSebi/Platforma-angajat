import { useEffect } from "react";
import type {
  DirectoryMemberSummary,
  EmployeeDirectoryResponse,
  PlatformAdministratorSummary
} from "@repo/shared-types";
import { PaginationBar, paginateClientSlice } from "../../../shared/components/PaginationBar";
import { usePagination } from "../../../shared/hooks/use-pagination";

const ROLE_LABELS: Record<string, string> = {
  SSM_ADMIN: "Administrator SSM",
  SSM_ENTITY_RESPONSIBLE: "Responsabil SSM",
  DEPARTMENT_MANAGER: "Manager departament",
  EMPLOYEE: "Angajat"
};

function formatRoles(roles: string[]): string {
  if (!roles.length) return "—";
  return roles.map((r) => ROLE_LABELS[r] ?? r).join(", ");
}

function formatAngajatiCount(count: number): string {
  if (count === 1) return "1 angajat";
  return `${count} angajați`;
}

function formatPuncteLucruCount(count: number): string {
  if (count === 1) return "1 punct de lucru";
  return `${count} puncte de lucru`;
}

function AdministratorsTable({ administrators }: { administrators: PlatformAdministratorSummary[] }) {
  const pagination = usePagination({ persistKey: "employee-static.administrators" });
  const paged = paginateClientSlice(administrators, pagination.page, pagination.pageSize);

  useEffect(() => {
    if (pagination.page > paged.totalPages) {
      pagination.setPage(paged.totalPages);
    }
  }, [pagination.page, paged.totalPages, pagination.setPage]);

  return (
    <>
      <div className="table-wrap">
        <table className="data-table team-members-table team-members-table--cols-4">
          <thead>
            <tr>
              <th scope="col">Nume / e-mail</th>
              <th scope="col">Roluri</th>
              <th scope="col">Angajat legat</th>
              <th scope="col">Punct de lucru</th>
            </tr>
          </thead>
          <tbody>
            {paged.items.map((admin) => (
              <tr key={admin.userId} className={admin.isSelf ? "team-member-self" : undefined}>
                <td data-label="Nume / e-mail">
                  {admin.fullName?.trim() || admin.email}
                  {admin.isSelf ? <span className="team-self-badge">tu</span> : null}
                  {admin.fullName?.trim() ? (
                    <div className="text-muted small">{admin.email}</div>
                  ) : null}
                </td>
                <td data-label="Roluri">{formatRoles(admin.roles)}</td>
                <td data-label="Angajat legat">{admin.employeeFullName ?? "—"}</td>
                <td data-label="Punct de lucru">{admin.worksiteName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationBar
        page={paged.page}
        pageSize={paged.pageSize}
        total={paged.total}
        totalPages={paged.totalPages}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </>
  );
}

function WorksiteMembersTable({
  members,
  worksiteId
}: {
  members: DirectoryMemberSummary[];
  worksiteId: string | null;
}) {
  const persistKey = `employee-static.worksite.${worksiteId ?? "unassigned"}`;
  const pagination = usePagination({ persistKey });
  const paged = paginateClientSlice(members, pagination.page, pagination.pageSize);

  useEffect(() => {
    if (pagination.page > paged.totalPages) {
      pagination.setPage(paged.totalPages);
    }
  }, [pagination.page, paged.totalPages, pagination.setPage]);

  return (
    <>
      <div className="table-wrap">
        <table className="data-table team-members-table team-members-table--cols-5">
          <thead>
            <tr>
              <th scope="col">Nume</th>
              <th scope="col">E-mail</th>
              <th scope="col">Departament</th>
              <th scope="col">Post</th>
              <th scope="col">Rol platformă</th>
            </tr>
          </thead>
          <tbody>
            {paged.items.map((m) => (
              <tr key={m.employeeId} className={m.isSelf ? "team-member-self" : undefined}>
                <td data-label="Nume">
                  {m.fullName}
                  {m.isSelf ? <span className="team-self-badge">tu</span> : null}
                </td>
                <td data-label="E-mail">{m.email}</td>
                <td data-label="Departament">{m.departmentName ?? "—"}</td>
                <td data-label="Post">{m.jobPositionName ?? "—"}</td>
                <td data-label="Rol platformă">{formatRoles(m.platformRoles)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationBar
        page={paged.page}
        pageSize={paged.pageSize}
        total={paged.total}
        totalPages={paged.totalPages}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </>
  );
}

export function AdminDirectorySection({
  data,
  isLoading,
  error
}: {
  data: EmployeeDirectoryResponse | undefined;
  isLoading: boolean;
  error: string | null;
}) {
  if (isLoading) {
    return (
      <section className="card" aria-labelledby="admin-directory-heading">
        <h2 id="admin-directory-heading">Organizație (vizualizare administrator)</h2>
        <p>Se încarcă…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card" aria-labelledby="admin-directory-heading">
        <h2 id="admin-directory-heading">Organizație (vizualizare administrator)</h2>
        <p className="feedback error" role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (!data) return null;

  return (
    <div className="admin-directory-stack">
      <section className="card" aria-labelledby="admin-directory-heading">
        <h2 id="admin-directory-heading">Organizație (vizualizare administrator)</h2>
        <p className="field-hint">
          {formatAngajatiCount(data.totals.employees)} activi în {formatPuncteLucruCount(data.totals.worksites)}. Ca
          administrator vezi toți utilizatorii, grupați pe locație.
        </p>
      </section>

      <section className="card" aria-labelledby="admin-users-heading">
        <h2 id="admin-users-heading">Administratori platformă</h2>
        {data.administrators.length === 0 ? (
          <p className="text-muted">Nu există conturi cu rol SSM_ADMIN.</p>
        ) : (
          <AdministratorsTable administrators={data.administrators} />
        )}
      </section>

      {data.worksites.map((group) => (
        <section
          key={group.worksite?.id ?? "unassigned"}
          className="card team-block"
          aria-labelledby={`worksite-${group.worksite?.id ?? "unassigned"}`}
        >
          <h2 className="team-block-title" id={`worksite-${group.worksite?.id ?? "unassigned"}`}>
            {group.worksite ? `${group.worksite.code} — ${group.worksite.name}` : "Fără punct de lucru"}
            <span className="text-muted small"> ({formatAngajatiCount(group.members.length)})</span>
          </h2>
          {group.members.length === 0 ? (
            <p className="text-muted">Niciun angajat activ la acest punct de lucru.</p>
          ) : (
            <WorksiteMembersTable members={group.members} worksiteId={group.worksite?.id ?? null} />
          )}
        </section>
      ))}
    </div>
  );
}
