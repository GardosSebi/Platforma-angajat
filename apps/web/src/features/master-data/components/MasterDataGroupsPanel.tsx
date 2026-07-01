import { FormEvent, useState } from "react";
import type { CreateEmployeeGroupPayload, EmployeeGroupItem } from "../api/master-data.api";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { OptionCardRadioGroup } from "../../../shared/components/OptionCardRadioGroup";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { usePagination } from "../../../shared/hooks/use-pagination";
import {
  useAddGroupMember,
  useCreateGroup,
  useEmployeeOptions,
  useGroup,
  useGroups,
  useRemoveGroupMember,
  useUpdateGroup
} from "../hooks/useMasterData";
import { ACTIVE_STATUS_CARD_OPTIONS, MASTER_DATA_ADD_LABELS, MASTER_DATA_CLOSE_FORM_CTA, activeLabel, activeTone, mutationErrorMessage } from "../master-data-shared";

const EMPTY_FORM: CreateEmployeeGroupPayload = {
  name: "",
  description: "",
  active: true
};

export function MasterDataGroupsPanel() {
  const pagination = usePagination();
  const query = useGroups(pagination.params);
  const paged = paginationFromResult(query.data, pagination.page, pagination.pageSize);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateEmployeeGroupPayload>(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberToAdd, setMemberToAdd] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const detailQuery = useGroup(selectedId ?? undefined);
  const employeeOptions = useEmployeeOptions(memberSearch, { enabled: Boolean(selectedId) });
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();

  const openGroup = (item: EmployeeGroupItem) => {
    setSelectedId(item.id);
    setEditName(item.name);
    setEditDescription(item.description ?? "");
    setEditActive(item.active);
    setMemberToAdd("");
    setFeedback(null);
  };

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    createGroup.mutate(
      {
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        active: form.active
      },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          setShowForm(false);
          setFeedback({ type: "success", message: "Grupul a fost creat." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onSaveGroup = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId) return;
    updateGroup.mutate(
      {
        id: selectedId,
        payload: {
          name: editName.trim(),
          description: editDescription.trim() || null,
          active: editActive
        }
      },
      {
        onSuccess: () => setFeedback({ type: "success", message: "Grupul a fost actualizat." }),
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onAddMember = () => {
    if (!selectedId || !memberToAdd) return;
    addMember.mutate(
      { groupId: selectedId, employeeId: memberToAdd },
      {
        onSuccess: () => {
          setMemberToAdd("");
          setFeedback({ type: "success", message: "Angajat adăugat în grup." });
        },
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const members = detailQuery.data?.members ?? [];
  const memberIds = new Set(members.map((m) => m.id));
  const addableOptions = (employeeOptions.data?.items ?? []).filter((e) => !memberIds.has(e.id));

  return (
    <>
      <section className="card comms-panel">
        <div className="comms-toolbar">
          <div className="comms-toolbar-start">
            <h2 className="card-title">Grupuri de instruire</h2>
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
            {showForm ? MASTER_DATA_CLOSE_FORM_CTA : MASTER_DATA_ADD_LABELS.groups}
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
                <th>Denumire</th>
                <th>Descriere</th>
                <th>Membri</th>
                <th>Stare</th>
                <th aria-label="Acțiuni" />
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td colSpan={5} className="text-muted">
                    Se încarcă...
                  </td>
                </tr>
              ) : null}
              {paged.items.map((item) => (
                <tr key={item.id}>
                  <td className="comms-title-cell">{item.name}</td>
                  <td>{item.description || "—"}</td>
                  <td>{item._count?.members ?? 0}</td>
                  <td>
                    <span className={`comms-status comms-status--${activeTone(item.active)}`}>
                      {activeLabel(item.active)}
                    </span>
                  </td>
                  <td className="comms-actions-cell">
                    <div className="comms-row-actions">
                      <button type="button" className="btn-secondary btn-sm" onClick={() => openGroup(item)}>
                        Gestionează
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
          disabled={query.isFetching}
        />
      </section>

      {showForm ? (
        <form className="card form-stack comms-panel md-create-form" onSubmit={onCreate}>
          <h3 className="card-title">Grup nou</h3>
          <div className="field">
            <label htmlFor="md-grp-name">Denumire *</label>
            <input
              id="md-grp-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ex: Personal depozit"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="md-grp-desc">Descriere</label>
            <input
              id="md-grp-desc"
              value={form.description ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="comms-compose-actions">
            <button className="btn-primary" type="submit" disabled={createGroup.isPending}>
              Salvează
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Anulează
            </button>
          </div>
        </form>
      ) : null}

      {selectedId ? (
        <section className="card comms-panel md-detail-panel">
          <div className="comms-toolbar">
            <h3 className="card-title">Grup: {editName}</h3>
            <button type="button" className="btn-secondary" onClick={() => setSelectedId(null)}>
              Închide
            </button>
          </div>

          {feedback ? (
            <div className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
              {feedback.message}
            </div>
          ) : null}

          <form className="form-stack" onSubmit={onSaveGroup}>
            <div className="field">
              <label htmlFor="md-grp-edit-name">Denumire</label>
              <input id="md-grp-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="md-grp-edit-desc">Descriere</label>
              <input
                id="md-grp-edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <OptionCardRadioGroup
              name="md-grp-edit-status"
              legend="Status"
              hint="Grupurile inactive nu se folosesc la atribuirea instruirilor."
              value={editActive ? "true" : "false"}
              onChange={(next) => setEditActive(next === "true")}
              options={[...ACTIVE_STATUS_CARD_OPTIONS]}
            />
            <button className="btn-primary" type="submit" disabled={updateGroup.isPending}>
              Salvează grup
            </button>
          </form>

          <div className="md-members-block">
            <h4>Membri ({members.length})</h4>
            <div className="comms-filters">
              <div className="field comms-search-field">
                <label htmlFor="md-grp-member-search">Caută angajat</label>
                <input
                  id="md-grp-member-search"
                  type="search"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Nume sau e-mail..."
                />
              </div>
              <FieldSelect
                id="md-grp-add-member"
                label="Adaugă angajat"
                value={memberToAdd}
                onChange={setMemberToAdd}
                allowEmpty
                emptyLabel="Selectează..."
                options={mapToOptions(
                  addableOptions,
                  (e) => e.id,
                  (e) => `${e.fullName} (${e.email})`
                )}
              />
              <button type="button" className="btn-primary" disabled={!memberToAdd || addMember.isPending} onClick={onAddMember}>
                Adaugă
              </button>
            </div>
            <ul className="md-member-list">
              {members.map((m) => (
                <li key={m.id}>
                  <span>
                    {m.fullName} — {m.email}
                    {!m.active ? " (inactiv)" : ""}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() =>
                      removeMember.mutate(
                        { groupId: selectedId, employeeId: m.id },
                        {
                          onError: (error) =>
                            setFeedback({ type: "error", message: mutationErrorMessage(error) })
                        }
                      )
                    }
                  >
                    Elimină
                  </button>
                </li>
              ))}
              {members.length === 0 ? <li className="text-muted">Niciun membru în acest grup.</li> : null}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
