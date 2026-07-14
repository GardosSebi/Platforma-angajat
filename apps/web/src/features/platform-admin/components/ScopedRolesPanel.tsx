import { FormEvent, useMemo, useState } from "react";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { SYSTEM_ROLE_LABELS_RO } from "../../../shared/constants/system-roles";
import { useGroups, useWorksites } from "../../master-data/hooks/useMasterData";
import { mutationErrorMessage } from "../../master-data/master-data-shared";
import { SCOPED_ROLE_OPTIONS } from "../platform-admin-shared";
import {
  useAdminUsers,
  useCreateScopedRole,
  useDeleteScopedRole,
  useScopedRoles
} from "../hooks/usePlatformAdmin";

export function ScopedRolesPanel() {
  const usersQuery = useAdminUsers({ page: 1, pageSize: 100 });
  const worksitesQuery = useWorksites({ page: 1, pageSize: 100 });
  const groupsQuery = useGroups({ page: 1, pageSize: 100 });

  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<string>(SCOPED_ROLE_OPTIONS[0]);
  const [scope, setScope] = useState<"WORKSITE" | "EMPLOYEE_GROUP">("WORKSITE");
  const [worksiteId, setWorksiteId] = useState("");
  const [employeeGroupId, setEmployeeGroupId] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const scopedRolesQuery = useScopedRoles(userId || undefined);
  const createScopedRole = useCreateScopedRole();
  const deleteScopedRole = useDeleteScopedRole();

  const userOptions = useMemo(
    () =>
      (usersQuery.data?.items ?? []).map((user) => ({
        value: user.id,
        label: `${user.fullName ?? user.email} (${user.email})`
      })),
    [usersQuery.data?.items]
  );

  const worksiteOptions = useMemo(
    () =>
      (worksitesQuery.data?.items ?? []).map((item) => ({
        value: item.id,
        label: `${item.code} — ${item.name}`
      })),
    [worksitesQuery.data?.items]
  );

  const groupOptions = useMemo(
    () =>
      (groupsQuery.data?.items ?? []).map((item) => ({
        value: item.id,
        label: item.name
      })),
    [groupsQuery.data?.items]
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    if (!userId) return;

    createScopedRole.mutate(
      {
        userId,
        role,
        scope,
        worksiteId: scope === "WORKSITE" ? worksiteId : undefined,
        employeeGroupId: scope === "EMPLOYEE_GROUP" ? employeeGroupId : undefined
      },
      {
        onSuccess: () => {
          setFeedback({ type: "success", message: "Rol scoped adăugat." });
        },
        onError: (error) => {
          setFeedback({ type: "error", message: mutationErrorMessage(error) });
        }
      }
    );
  };

  return (
    <div className="card form-stack">
      <h2 className="card-title">Roluri scoped per utilizator</h2>
      <p className="page-lead">
        Limitează vizibilitatea unui utilizator la un punct de lucru sau la un grup de angajați.
      </p>

      <form className="form-stack" onSubmit={onSubmit}>
        <FieldSelect
          id="scoped-user"
          label="Utilizator"
          value={userId}
          onChange={setUserId}
          options={userOptions}
          required
          allowEmpty
          emptyLabel="Selectează utilizator"
        />

        <FieldSelect
          id="scoped-role"
          label="Rol"
          value={role}
          onChange={setRole}
          options={SCOPED_ROLE_OPTIONS.map((item) => ({
            value: item,
            label: SYSTEM_ROLE_LABELS_RO[item as keyof typeof SYSTEM_ROLE_LABELS_RO] ?? item
          }))}
          required
        />

        <FieldSelect
          id="scoped-scope"
          label="Tip scope"
          value={scope}
          onChange={(value) => setScope(value as "WORKSITE" | "EMPLOYEE_GROUP")}
          options={[
            { value: "WORKSITE", label: "Punct de lucru" },
            { value: "EMPLOYEE_GROUP", label: "Grup angajați" }
          ]}
          required
        />

        {scope === "WORKSITE" ? (
          <FieldSelect
            id="scoped-worksite"
            label="Punct de lucru"
            value={worksiteId}
            onChange={setWorksiteId}
            options={worksiteOptions}
            required
            allowEmpty
            emptyLabel="Selectează punct"
          />
        ) : (
          <FieldSelect
            id="scoped-group"
            label="Grup angajați"
            value={employeeGroupId}
            onChange={setEmployeeGroupId}
            options={groupOptions}
            required
            allowEmpty
            emptyLabel="Selectează grup"
          />
        )}

        <button type="submit" className="btn-primary" disabled={createScopedRole.isPending || !userId}>
          {createScopedRole.isPending ? "Se salvează..." : "Adaugă rol scoped"}
        </button>
      </form>

      {feedback ? (
        <p className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
          {feedback.message}
        </p>
      ) : null}

      {userId ? (
        <section className="form-stack">
          <h3 className="card-title">Roluri existente</h3>
          {scopedRolesQuery.isLoading ? <p>Se încarcă...</p> : null}
          {(scopedRolesQuery.data ?? []).length === 0 && !scopedRolesQuery.isLoading ? (
            <p className="muted">Nu există roluri scoped pentru acest utilizator.</p>
          ) : null}
          <ul className="list-plain">
            {(scopedRolesQuery.data ?? []).map((item) => (
              <li key={item.id} className="list-row">
                <div>
                  <strong>{item.role}</strong>
                  <span className="muted">
                    {" "}
                    — {item.scope}
                    {item.worksite ? `: ${item.worksite.code}` : ""}
                    {item.employeeGroup ? `: ${item.employeeGroup.name}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={deleteScopedRole.isPending}
                  onClick={() =>
                    deleteScopedRole.mutate(
                      { id: item.id, userId },
                      {
                        onError: (error) => {
                          setFeedback({ type: "error", message: mutationErrorMessage(error) });
                        }
                      }
                    )
                  }
                >
                  Șterge
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
