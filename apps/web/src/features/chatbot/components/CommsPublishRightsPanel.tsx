import { FormEvent, useMemo, useState } from "react";
import {
  COMMUNICATION_PUBLISH_SCOPES,
  type CommunicationPublishScope,
  type CreateCommunicationPublishRightRequest
} from "@repo/shared-types/communication-rights";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { useGroups, useLegalEntitiesLookup, useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import { useAdminUsers } from "../../platform-admin/hooks/usePlatformAdmin";
import { formatCommsDate, mutationErrorMessage } from "../comms-shared";
import { useCreatePublishRight, useDeletePublishRight, usePublishRights } from "../hooks/useChatbot";

const SCOPE_LABELS: Record<CommunicationPublishScope, string> = {
  ALL: "Toată organizația",
  LEGAL_ENTITY: "Companie",
  EMPLOYEE_GROUP: "Grup angajați",
  WORKSITE: "Punct de lucru"
};

const EMPTY_FORM: CreateCommunicationPublishRightRequest = {
  userId: "",
  scopeType: "ALL",
  canPublish: true,
  canManageTemplates: false
};

function scopeLabel(row: {
  scopeType: CommunicationPublishScope;
  legalEntity?: { code: string; name: string } | null;
  employeeGroup?: { name: string } | null;
  worksite?: { code: string; name: string } | null;
}): string {
  if (row.scopeType === "ALL") return SCOPE_LABELS.ALL;
  if (row.scopeType === "LEGAL_ENTITY" && row.legalEntity) {
    return `${SCOPE_LABELS.LEGAL_ENTITY}: ${row.legalEntity.code} — ${row.legalEntity.name}`;
  }
  if (row.scopeType === "EMPLOYEE_GROUP" && row.employeeGroup) {
    return `${SCOPE_LABELS.EMPLOYEE_GROUP}: ${row.employeeGroup.name}`;
  }
  if (row.scopeType === "WORKSITE" && row.worksite) {
    return `${SCOPE_LABELS.WORKSITE}: ${row.worksite.code} — ${row.worksite.name}`;
  }
  return SCOPE_LABELS[row.scopeType];
}

export function CommsPublishRightsPanel() {
  const rightsQuery = usePublishRights();
  const usersQuery = useAdminUsers({ page: 1, pageSize: 100 });
  const legalEntitiesLookup = useLegalEntitiesLookup();
  const groupsLookup = useGroups({ page: 1, pageSize: 100 });
  const worksitesLookup = useWorksitesLookup();

  const createRight = useCreatePublishRight();
  const deleteRight = useDeletePublishRight();

  const [form, setForm] = useState<CreateCommunicationPublishRightRequest>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const userOptions = useMemo(
    () =>
      (usersQuery.data?.items ?? []).map((user) => ({
        value: user.id,
        label: `${user.fullName ?? user.email} (${user.email})`
      })),
    [usersQuery.data?.items]
  );

  const legalEntityOptions = useMemo(
    () =>
      (legalEntitiesLookup.data?.items ?? []).map((item) => ({
        value: item.id,
        label: `${item.code} — ${item.name}`
      })),
    [legalEntitiesLookup.data?.items]
  );

  const groupOptions = useMemo(
    () =>
      (groupsLookup.data?.items ?? []).map((item) => ({
        value: item.id,
        label: item.name
      })),
    [groupsLookup.data?.items]
  );

  const worksiteOptions = useMemo(
    () =>
      (worksitesLookup.data?.items ?? []).map((item) => ({
        value: item.id,
        label: `${item.code} — ${item.name}`
      })),
    [worksitesLookup.data?.items]
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    if (!form.userId) {
      setFeedback({ type: "error", message: "Selectează un utilizator." });
      return;
    }

    const payload: CreateCommunicationPublishRightRequest = {
      userId: form.userId,
      scopeType: form.scopeType,
      canPublish: form.canPublish ?? true,
      canManageTemplates: form.canManageTemplates ?? false,
      legalEntityId: form.scopeType === "LEGAL_ENTITY" ? form.legalEntityId || null : null,
      employeeGroupId: form.scopeType === "EMPLOYEE_GROUP" ? form.employeeGroupId || null : null,
      worksiteId: form.scopeType === "WORKSITE" ? form.worksiteId || null : null
    };

    createRight.mutate(payload, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        setFeedback({ type: "success", message: "Drept de publicare adăugat." });
      },
      onError: (error) => {
        setFeedback({ type: "error", message: mutationErrorMessage(error) });
      }
    });
  };

  const onDelete = (id: string) => {
    if (!window.confirm("Sigur vrei să ștergi acest drept de publicare?")) return;
    setFeedback(null);
    deleteRight.mutate(id, {
      onSuccess: () => setFeedback({ type: "success", message: "Drept șters." }),
      onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
    });
  };

  const rights = rightsQuery.data ?? [];

  return (
    <div className="form-stack">
      <form className="card form-stack comms-panel" onSubmit={onSubmit}>
        <h2 className="card-title">Drepturi de publicare comunicări</h2>
        <p className="comms-toolbar-hint">
          Acordă utilizatorilor dreptul de a publica anunțuri și/sau de a administra șabloane, pe scopuri
          organizaționale.
        </p>

        <FieldSelect
          id="publish-right-user"
          label="Utilizator *"
          value={form.userId}
          onChange={(userId) => setForm((prev) => ({ ...prev, userId }))}
          options={userOptions}
          allowEmpty
          emptyLabel="Selectează utilizator"
          required
        />

        <FieldSelect
          id="publish-right-scope"
          label="Scop"
          value={form.scopeType}
          onChange={(scopeType) =>
            setForm((prev) => ({
              ...prev,
              scopeType: scopeType as CommunicationPublishScope,
              legalEntityId: "",
              employeeGroupId: "",
              worksiteId: ""
            }))
          }
          options={COMMUNICATION_PUBLISH_SCOPES.map((scope) => ({
            value: scope,
            label: SCOPE_LABELS[scope]
          }))}
        />

        {form.scopeType === "LEGAL_ENTITY" ? (
          <FieldSelect
            id="publish-right-legal-entity"
            label="Companie *"
            value={form.legalEntityId ?? ""}
            onChange={(legalEntityId) => setForm((prev) => ({ ...prev, legalEntityId }))}
            options={legalEntityOptions}
            allowEmpty
            emptyLabel="Selectează companie"
            required
          />
        ) : null}

        {form.scopeType === "EMPLOYEE_GROUP" ? (
          <FieldSelect
            id="publish-right-group"
            label="Grup angajați *"
            value={form.employeeGroupId ?? ""}
            onChange={(employeeGroupId) => setForm((prev) => ({ ...prev, employeeGroupId }))}
            options={groupOptions}
            allowEmpty
            emptyLabel="Selectează grup"
            required
          />
        ) : null}

        {form.scopeType === "WORKSITE" ? (
          <FieldSelect
            id="publish-right-worksite"
            label="Punct de lucru *"
            value={form.worksiteId ?? ""}
            onChange={(worksiteId) => setForm((prev) => ({ ...prev, worksiteId }))}
            options={worksiteOptions}
            allowEmpty
            emptyLabel="Selectează punct de lucru"
            required
          />
        ) : null}

        <div className="comms-form-row">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.canPublish ?? true}
              onChange={(event) => setForm((prev) => ({ ...prev, canPublish: event.target.checked }))}
            />
            Poate publica anunțuri
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.canManageTemplates ?? false}
              onChange={(event) => setForm((prev) => ({ ...prev, canManageTemplates: event.target.checked }))}
            />
            Poate administra șabloane
          </label>
        </div>

        <button className="btn-primary" type="submit" disabled={createRight.isPending}>
          {createRight.isPending ? "Se salvează..." : "Adaugă drept"}
        </button>

        {feedback ? (
          <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
            {feedback.message}
          </div>
        ) : null}
      </form>

      <div className="card comms-panel form-stack">
        <h3 className="card-title">Drepturi existente ({rights.length})</h3>
        {rightsQuery.isLoading ? <p className="field-hint">Se încarcă...</p> : null}
        {!rightsQuery.isLoading && rights.length === 0 ? (
          <p className="field-hint">Nu există drepturi configurate.</p>
        ) : null}
        <ul className="list-plain">
          {rights.map((row) => (
            <li key={row.id} className="list-row">
              <div>
                <strong>{row.user?.fullName ?? row.user?.email ?? row.userId}</strong>
                <span className="muted"> — {row.user?.email}</span>
                <span className="muted"> · {scopeLabel(row)}</span>
                <span className="muted">
                  {" "}
                  · {row.canPublish ? "Publicare" : ""}
                  {row.canPublish && row.canManageTemplates ? ", " : ""}
                  {row.canManageTemplates ? "Șabloane" : ""}
                </span>
                <span className="muted"> · Adăugat: {formatCommsDate(row.createdAt)}</span>
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm btn-danger"
                disabled={deleteRight.isPending}
                onClick={() => onDelete(row.id)}
              >
                Șterge
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
