import { FormEvent, useEffect, useMemo, useState } from "react";
import type { TenantUserSummary } from "@repo/shared-types";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { OptionCardRadioGroup } from "../../../shared/components/OptionCardRadioGroup";
import { PasswordToggleButton } from "../../../shared/components/PasswordToggleButton";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import {
  assignableSystemRoles,
  SYSTEM_ROLE_CARD_OPTIONS,
  type SystemRoleCode
} from "../../../shared/constants/system-roles";
import {
  ACTIVE_STATUS_CARD_OPTIONS,
  MASTER_DATA_CLOSE_FORM_CTA,
  activeLabel,
  activeTone,
  mutationErrorMessage
} from "../../master-data/master-data-shared";
import type { CreateTenantUserPayload } from "../api/platform-admin.api";
import { useAdminUsers, useCreateUser, usePatchUser } from "../hooks/usePlatformAdmin";

const EMPTY_CREATE: Pick<CreateTenantUserPayload, "email" | "fullName"> = {
  email: "",
  fullName: ""
};

function formatRoles(roles: string[]): string {
  if (roles.length === 0) return "—";
  return roles.join(", ");
}

export function UsersPanel() {
  const session = useAuthSession();
  const pagination = usePagination();
  const usersQuery = useAdminUsers(pagination.params);
  const createUser = useCreateUser();
  const patchUser = usePatchUser();

  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createPassword, setCreatePassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createRole, setCreateRole] = useState<SystemRoleCode>("EMPLOYEE");
  const [editRole, setEditRole] = useState<SystemRoleCode>("EMPLOYEE");
  const [editActive, setEditActive] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const paged = paginationFromResult(usersQuery.data, pagination.page, pagination.pageSize);
  const selectedUser = paged.items.find((item) => item.id === selectedId);

  const roleCardOptions = useMemo(() => {
    const allowed = new Set(assignableSystemRoles(session?.roles));
    return SYSTEM_ROLE_CARD_OPTIONS.filter((option) => allowed.has(option.value as SystemRoleCode));
  }, [session?.roles]);

  useEffect(() => {
    if (!selectedUser) return;
    setEditRole((selectedUser.roles[0] as SystemRoleCode) ?? "EMPLOYEE");
    setEditActive(selectedUser.active);
  }, [selectedUser]);

  const openDetail = (user: TenantUserSummary) => {
    setFeedback(null);
    setSelectedId(user.id);
    setEditRole((user.roles[0] as SystemRoleCode) ?? "EMPLOYEE");
    setEditActive(user.active);
  };

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    if (createPassword.trim().length < 8) {
      setFeedback({ type: "error", message: "Parola trebuie să aibă cel puțin 8 caractere." });
      return;
    }
    createUser.mutate(
      {
        email: createForm.email.trim(),
        fullName: createForm.fullName.trim(),
        password: createPassword,
        roles: [createRole]
      },
      {
        onSuccess: () => {
          setCreateForm(EMPTY_CREATE);
          setCreatePassword("");
          setShowCreatePassword(false);
          setCreateRole("EMPLOYEE");
          setShowForm(false);
          setFeedback({ type: "success", message: "Utilizator creat." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onSaveUser = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !selectedUser) return;
    setFeedback(null);
    const payload: { roles?: string[]; active?: boolean } = {};
    const currentRole = selectedUser.roles[0] ?? "EMPLOYEE";
    if (currentRole !== editRole) {
      payload.roles = [editRole];
    }
    if (selectedUser.active !== editActive) {
      payload.active = editActive;
    }
    if (Object.keys(payload).length === 0) {
      setFeedback({ type: "success", message: "Nu există modificări de salvat." });
      return;
    }
    patchUser.mutate(
      { userId: selectedId, payload },
      {
        onSuccess: () => setFeedback({ type: "success", message: "Utilizator actualizat." }),
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  return (
    <>
      <section className="card comms-panel">
        <div className="comms-toolbar">
          <div className="comms-toolbar-start">
            <h2 className="card-title">Utilizatori</h2>
            <p className="comms-toolbar-hint">{paged.total} în total</p>
          </div>
          <button
            type="button"
            className="btn-primary comms-toolbar-cta"
            onClick={() => {
              setFeedback(null);
              setShowForm((prev) => !prev);
            }}
          >
            {showForm ? MASTER_DATA_CLOSE_FORM_CTA : "Adaugă utilizator"}
          </button>
        </div>

        {feedback && !showForm && !selectedId ? (
          <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
            {feedback.message}
          </div>
        ) : null}

        <div className="table-wrap">
          <table className="data-table comms-table">
            <thead>
              <tr>
                <th>Nume</th>
                <th>E-mail</th>
                <th>Rol</th>
                <th>Stare</th>
                <th aria-label="Acțiuni" />
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="text-muted">
                    Se încarcă...
                  </td>
                </tr>
              ) : null}
              {!usersQuery.isLoading && paged.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="comms-empty-cell">
                    <p>Nu există utilizatori înregistrați.</p>
                  </td>
                </tr>
              ) : null}
              {paged.items.map((item) => (
                <tr key={item.id} className={selectedId === item.id ? "comms-row-selected" : undefined}>
                  <td className="comms-title-cell">{item.fullName ?? "—"}</td>
                  <td>{item.email}</td>
                  <td>{formatRoles(item.roles)}</td>
                  <td>
                    <span className={`comms-status comms-status--${activeTone(item.active)}`}>
                      {activeLabel(item.active)}
                    </span>
                  </td>
                  <td className="comms-actions-cell">
                    <div className="comms-row-actions">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => openDetail(item)}>
                        Detalii
                      </button>
                    </div>
                  </td>
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
          disabled={usersQuery.isFetching}
        />
      </section>

      {showForm ? (
        <form className="card form-stack comms-panel" onSubmit={onCreate}>
          <h3 className="card-title">Utilizator nou</h3>
          <div className="comms-form-row">
            <div className="field">
              <label htmlFor="pa-user-name">Nume complet *</label>
              <input
                id="pa-user-name"
                value={createForm.fullName}
                onChange={(e) => setCreateForm((p) => ({ ...p, fullName: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="pa-user-email">E-mail *</label>
              <input
                id="pa-user-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pa-user-password">Parolă *</label>
            <div className="password-field-row">
              <input
                id="pa-user-password"
                type={showCreatePassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Minim 8 caractere"
                required
              />
              <PasswordToggleButton
                visible={showCreatePassword}
                onToggle={() => setShowCreatePassword((value) => !value)}
              />
            </div>
          </div>
          <OptionCardRadioGroup
            name="pa-user-create-role"
            legend="Rol"
            hint="Alege un singur rol pentru contul de autentificare."
            value={createRole}
            onChange={(role) => setCreateRole(role as SystemRoleCode)}
            options={roleCardOptions}
          />
          <div className="comms-compose-actions">
            <button className="btn-primary" type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? "Se salvează..." : "Salvează"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Anulează
            </button>
          </div>
          {feedback && showForm ? (
            <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
              {feedback.message}
            </div>
          ) : null}
        </form>
      ) : null}

      {selectedId && selectedUser ? (
        <section className="card comms-panel">
          <div className="comms-toolbar">
            <h3 className="card-title">{selectedUser.fullName ?? selectedUser.email}</h3>
            <button type="button" className="btn-secondary" onClick={() => setSelectedId(null)}>
              Închide
            </button>
          </div>

          {feedback && selectedId ? (
            <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
              {feedback.message}
            </div>
          ) : null}

          <form className="form-stack" onSubmit={onSaveUser}>
            <p className="text-muted small">{selectedUser.email}</p>
            <OptionCardRadioGroup
              name="pa-user-edit-role"
              legend="Rol utilizator"
              hint="Rolul contului de autentificare."
              value={editRole}
              onChange={(role) => setEditRole(role as SystemRoleCode)}
              options={roleCardOptions}
            />
            <OptionCardRadioGroup
              name="pa-user-edit-status"
              legend="Stare cont"
              hint="Contul inactiv nu poate autentifica în platformă."
              value={editActive ? "true" : "false"}
              onChange={(next) => setEditActive(next === "true")}
              options={[...ACTIVE_STATUS_CARD_OPTIONS]}
            />
            <button className="btn-primary" type="submit" disabled={patchUser.isPending}>
              {patchUser.isPending ? "Se salvează..." : "Salvează modificările"}
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}
