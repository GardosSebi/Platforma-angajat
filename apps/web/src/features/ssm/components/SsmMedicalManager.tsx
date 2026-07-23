import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  CreateSsmMedicalControlRequest,
  CreateSsmMedicalControlTypeRequest,
  SsmMedicalControlCategory,
  SsmMedicalControlItem,
  SsmMedicalControlResult,
  UpdateSsmMedicalControlRequest
} from "@repo/shared-types/ssm";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { useEmployeeOptions, useJobPositionsLookup } from "../../master-data/hooks/useMasterData";
import { ssmApi } from "../api/ssm.api";
import {
  useCreateMedicalControl,
  useCreateMedicalControlType,
  useMedicalControls,
  useMedicalControlTypes,
  useMedicalReminders,
  useUpdateMedicalControl
} from "../hooks/useSsmMedical";

type MedicalTab = "types" | "register" | "update" | "reminders";

const MEDICAL_TABS: Array<{ id: MedicalTab; title: string; caption: string }> = [
  { id: "types", title: "Tipuri control", caption: "Config pe post și categorie" },
  { id: "register", title: "Registru", caption: "Listă și înregistrare" },
  { id: "update", title: "Actualizare", caption: "Rezultat și fișă aptitudini" },
  { id: "reminders", title: "Reminder", caption: "Scadențe și întârzieri" }
];

const CONTROL_RESULTS: SsmMedicalControlResult[] = ["FIT", "FIT_CONDITIONAL", "TEMPORARY_UNFIT", "UNFIT"];
const CONTROL_CATEGORIES: SsmMedicalControlCategory[] = ["HIRE", "PERIODIC", "RESUME", "JOB_CHANGE"];

const EMPTY_TYPE: CreateSsmMedicalControlTypeRequest = {
  code: "",
  name: "",
  jobPositionId: "",
  category: "PERIODIC",
  recurrenceDays: 365,
  reminderDays: [30, 15, 7]
};

const EMPTY_CONTROL: CreateSsmMedicalControlRequest = {
  employeeId: "",
  controlTypeId: "",
  scheduledAt: new Date().toISOString(),
  performedAt: new Date().toISOString(),
  result: "FIT",
  recommendations: "",
  validityUntil: ""
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function resultLabel(result: SsmMedicalControlResult | "" | null | undefined): string {
  switch (result) {
    case "FIT":
      return "Apt";
    case "FIT_CONDITIONAL":
      return "Apt condiționat";
    case "TEMPORARY_UNFIT":
      return "Inapt temporar";
    case "UNFIT":
      return "Inapt permanent";
    default:
      return "Neselectat";
  }
}

function categoryLabel(category: SsmMedicalControlCategory): string {
  switch (category) {
    case "HIRE":
      return "La angajare";
    case "PERIODIC":
      return "Periodic";
    case "RESUME":
      return "La reluare activitate";
    case "JOB_CHANGE":
      return "La schimbare post";
    default:
      return category;
  }
}

export function SsmMedicalManager() {
  const [tab, setTab] = useState<MedicalTab>("register");
  const activeTabMeta = MEDICAL_TABS.find((item) => item.id === tab) ?? MEDICAL_TABS[0];

  const typesQuery = useMedicalControlTypes();
  const controlsQuery = useMedicalControls();
  const remindersQuery = useMedicalReminders();
  const jobPositionsQuery = useJobPositionsLookup();
  const employeesQuery = useEmployeeOptions();
  const jobPositions = jobPositionsQuery.data?.items ?? [];
  const employeeOptions = employeesQuery.data?.items ?? [];

  const createType = useCreateMedicalControlType();
  const createControl = useCreateMedicalControl();
  const updateControl = useUpdateMedicalControl();

  const [typeForm, setTypeForm] = useState<CreateSsmMedicalControlTypeRequest>(EMPTY_TYPE);
  const [controlForm, setControlForm] = useState<CreateSsmMedicalControlRequest>(EMPTY_CONTROL);
  const [aptitudeSheet, setAptitudeSheet] = useState<File>();
  const [editAptitudeSheet, setEditAptitudeSheet] = useState<File>();
  const [selectedControlId, setSelectedControlId] = useState("");
  const [editForm, setEditForm] = useState<UpdateSsmMedicalControlRequest>({});
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTypeForm, setShowTypeForm] = useState(false);

  useEffect(() => {
    if (!controlForm.employeeId && employeeOptions[0]?.id) {
      setControlForm((prev) => ({ ...prev, employeeId: employeeOptions[0]!.id }));
    }
  }, [employeeOptions, controlForm.employeeId]);

  const typeOptions = typesQuery.data ?? [];
  const controls = controlsQuery.data?.items ?? [];

  const selectedControl: SsmMedicalControlItem | undefined = useMemo(
    () => controls.find((item) => item.id === selectedControlId),
    [controls, selectedControlId]
  );

  useEffect(() => {
    if (!selectedControl) {
      setEditForm({});
      return;
    }
    setEditForm({
      performedAt: selectedControl.performedAt ?? undefined,
      result: selectedControl.result ?? undefined,
      recommendations: selectedControl.recommendations ?? "",
      validityUntil: selectedControl.validityUntil ?? undefined
    });
    setEditAptitudeSheet(undefined);
  }, [selectedControl]);

  const selectForUpdate = (controlId: string) => {
    setSelectedControlId(controlId);
    setTab("update");
  };

  const onCreateType = (event: FormEvent) => {
    event.preventDefault();
    if (!typeForm.jobPositionId) return;
    createType.mutate(
      {
        ...typeForm,
        jobPositionId: typeForm.jobPositionId.trim()
      },
      {
        onSuccess: (created) => {
          setControlForm((prev) => ({ ...prev, controlTypeId: created.id }));
          setTypeForm(EMPTY_TYPE);
          setShowTypeForm(false);
        }
      }
    );
  };

  const onCreateControl = (event: FormEvent) => {
    event.preventDefault();
    createControl.mutate(
      {
        payload: {
          ...controlForm,
          result: controlForm.result || undefined
        },
        aptitudeSheet
      },
      {
        onSuccess: (created) => {
          setShowCreateForm(false);
          setAptitudeSheet(undefined);
          setControlForm((prev) => ({
            ...EMPTY_CONTROL,
            employeeId: prev.employeeId,
            controlTypeId: prev.controlTypeId
          }));
          selectForUpdate(created.id);
        }
      }
    );
  };

  const onUpdateControl = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedControlId) return;
    updateControl.mutate({
      controlId: selectedControlId,
      payload: editForm,
      aptitudeSheet: editAptitudeSheet
    });
  };

  const downloadSheet = (controlId: string, fileName?: string | null) => {
    setDownloadError(null);
    void downloadWithAuth(
      ssmApi.getMedicalAptitudeSheetUrl(controlId),
      fileName ?? `fisa-aptitudini-${controlId}.pdf`
    ).catch((error: unknown) => setDownloadError(mutationErrorMessage(error)));
  };

  return (
    <section className="ssm-eip-panel" aria-label="Modul medicina muncii">
      <div className="ssm-panel-tabs" role="tablist" aria-label="Secțiuni medicina muncii">
        {MEDICAL_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`ssm-panel-tab ${tab === item.id ? "active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            <strong>{item.title}</strong>
            <span>{item.caption}</span>
          </button>
        ))}
      </div>

      <header className="ssm-panel-header">
        <h3 className="card-title">{activeTabMeta.title}</h3>
        <p className="field-hint">{activeTabMeta.caption}</p>
      </header>

      {tab === "types" ? (
        <div className="ssm-panel-layout">
          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                Tipuri configurate
              </h4>
              <button type="button" className="btn-primary" onClick={() => setShowTypeForm((v) => !v)}>
                {showTypeForm ? "Ascunde formular" : "Tip nou"}
              </button>
            </div>
            <div className="ssm-history-list">
              {typeOptions.map((t) => (
                <div key={t.id} className="ssm-history-item">
                  <div>
                    <strong>
                      {t.code} — {t.name}
                    </strong>
                    <div className="field-hint">
                      {categoryLabel(t.category)} · {t.jobPositionName ?? t.jobPositionId}
                      {t.recurrenceDays ? ` · la ${t.recurrenceDays} zile` : ""}
                    </div>
                  </div>
                </div>
              ))}
              {!typeOptions.length ? <p className="field-hint">Nu există tipuri. Adaugă primul tip pe post.</p> : null}
            </div>
          </div>

          {showTypeForm ? (
            <form className="card form-stack ssm-doc-card" onSubmit={onCreateType}>
              <h4 className="card-title">Tip control nou</h4>
              <div className="field">
                <label htmlFor="med-code">Cod</label>
                <input
                  id="med-code"
                  required
                  value={typeForm.code}
                  onChange={(e) => setTypeForm((p) => ({ ...p, code: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="med-name">Denumire</label>
                <input
                  id="med-name"
                  required
                  value={typeForm.name}
                  onChange={(e) => setTypeForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <FieldSelect
                id="med-category"
                label="Categorie legală"
                value={typeForm.category}
                onChange={(category) => setTypeForm((p) => ({ ...p, category: category as SsmMedicalControlCategory }))}
                options={CONTROL_CATEGORIES.map((category) => ({ value: category, label: categoryLabel(category) }))}
              />
              <FieldSelect
                id="med-job-position"
                label="Post"
                value={typeForm.jobPositionId}
                onChange={(jobPositionId) => setTypeForm((p) => ({ ...p, jobPositionId }))}
                allowEmpty
                emptyLabel="Selectează post"
                options={mapToOptions(
                  jobPositions,
                  (job) => job.id,
                  (job) => `${job.code} — ${job.name}`
                )}
              />
              <div className="field">
                <label htmlFor="med-recurrence">Recurență (zile)</label>
                <input
                  id="med-recurrence"
                  type="number"
                  value={typeForm.recurrenceDays ?? 365}
                  onChange={(e) => setTypeForm((p) => ({ ...p, recurrenceDays: Number(e.target.value || 365) }))}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={createType.isPending || !typeForm.jobPositionId}>
                {createType.isPending ? "Se salvează..." : "Salvează tip"}
              </button>
              {createType.isError ? (
                <p className="feedback error" role="alert">
                  {mutationErrorMessage(createType.error)}
                </p>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}

      {tab === "register" ? (
        <div className="ssm-panel-layout">
          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                Controale înregistrate
              </h4>
              <button type="button" className="btn-primary" onClick={() => setShowCreateForm((v) => !v)}>
                {showCreateForm ? "Ascunde formular" : "Control nou"}
              </button>
            </div>
            {downloadError ? <p className="feedback error">{downloadError}</p> : null}
            <div className="ssm-history-list">
              {controls.map((item) => (
                <div key={item.id} className="ssm-history-item">
                  <div>
                    <strong>{item.employeeName}</strong>
                    <div className="field-hint">
                      {item.controlTypeName}
                      {item.controlTypeCategory ? ` · ${categoryLabel(item.controlTypeCategory)}` : ""} ·{" "}
                      {resultLabel(item.result)}
                      {item.nextDueAt ? ` · scadență ${item.nextDueAt}` : ""}
                    </div>
                  </div>
                  <div className="ssm-inline-actions">
                    {item.hasAptitudeSheet || item.aptitudeSheetName ? (
                      <button
                        type="button"
                        className="btn-text"
                        onClick={() => downloadSheet(item.id, item.aptitudeSheetName)}
                      >
                        Fișă
                      </button>
                    ) : (
                      <span className="badge-bad">Fără fișă</span>
                    )}
                    <button type="button" className="btn-text" onClick={() => selectForUpdate(item.id)}>
                      Actualizează
                    </button>
                  </div>
                </div>
              ))}
              {!controls.length ? <p className="field-hint">Nu există controale. Adaugă primul control.</p> : null}
            </div>
          </div>

          {showCreateForm ? (
            <form className="card form-stack ssm-doc-card" onSubmit={onCreateControl}>
              <h4 className="card-title">Înregistrare control</h4>
              <EmployeeSelect
                id="med-employee"
                value={controlForm.employeeId}
                required
                onChange={(employeeId) => setControlForm((p) => ({ ...p, employeeId }))}
              />
              <FieldSelect
                id="med-type"
                label="Tip control"
                value={controlForm.controlTypeId}
                onChange={(controlTypeId) => setControlForm((p) => ({ ...p, controlTypeId }))}
                allowEmpty
                emptyLabel="Selectează tip"
                options={mapToOptions(
                  typeOptions,
                  (type) => type.id,
                  (type) => `${type.code} - ${type.name} (${categoryLabel(type.category)})`
                )}
              />
              <div className="field">
                <label htmlFor="med-scheduled">Programare</label>
                <input
                  id="med-scheduled"
                  value={controlForm.scheduledAt}
                  onChange={(e) => setControlForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="med-performed">Efectuat la</label>
                <input
                  id="med-performed"
                  value={controlForm.performedAt ?? ""}
                  onChange={(e) => setControlForm((p) => ({ ...p, performedAt: e.target.value }))}
                />
              </div>
              <FieldSelect
                id="med-result"
                label="Rezultat"
                value={controlForm.result ?? ""}
                onChange={(result) =>
                  setControlForm((p) => ({ ...p, result: (result as SsmMedicalControlResult) || undefined }))
                }
                allowEmpty
                emptyLabel="Neselectat"
                options={CONTROL_RESULTS.map((result) => ({ value: result, label: resultLabel(result) }))}
              />
              <div className="field">
                <label htmlFor="med-validity">Valabil până la</label>
                <input
                  id="med-validity"
                  value={controlForm.validityUntil ?? ""}
                  onChange={(e) => setControlForm((p) => ({ ...p, validityUntil: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="med-recommendations">Recomandări</label>
                <input
                  id="med-recommendations"
                  value={controlForm.recommendations ?? ""}
                  onChange={(e) => setControlForm((p) => ({ ...p, recommendations: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="med-aptitude">Fișă aptitudini (PDF/JPG/PNG)</label>
                <input
                  id="med-aptitude"
                  type="file"
                  onChange={(e) => setAptitudeSheet(e.target.files?.[0])}
                  accept=".pdf,.png,.jpg,.jpeg"
                />
              </div>
              <button
                type="submit"
                className="btn-primary"
                disabled={createControl.isPending || !controlForm.controlTypeId}
              >
                {createControl.isPending ? "Se salvează..." : "Salvează control"}
              </button>
              {createControl.isError ? (
                <p className="feedback error" role="alert">
                  {mutationErrorMessage(createControl.error)}
                </p>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : null}

      {tab === "update" ? (
        <div className="ssm-panel-layout">
          <div className="card form-stack ssm-doc-card">
            <FieldSelect
              id="update-case"
              label="Selectează controlul"
              value={selectedControlId}
              onChange={setSelectedControlId}
              allowEmpty
              emptyLabel="Alege din registru"
              options={mapToOptions(
                controls,
                (item) => item.id,
                (item) => `${item.employeeName} — ${item.controlTypeName} (${resultLabel(item.result)})`
              )}
            />

            {!selectedControl ? (
              <p className="field-hint">Alege un control sau deschide-l din Registru cu „Actualizează”.</p>
            ) : (
              <form className="form-stack" onSubmit={onUpdateControl}>
                <div className="ssm-history-item">
                  <div>
                    <strong>{selectedControl.employeeName}</strong>
                    <div className="field-hint">
                      {selectedControl.controlTypeName} · {resultLabel(selectedControl.result)}
                    </div>
                  </div>
                  {selectedControl.hasAptitudeSheet || selectedControl.aptitudeSheetName ? (
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => downloadSheet(selectedControl.id, selectedControl.aptitudeSheetName)}
                    >
                      Descarcă fișa
                    </button>
                  ) : null}
                </div>

                <FieldSelect
                  id="edit-result"
                  label="Rezultat aptitudine"
                  value={editForm.result ?? ""}
                  onChange={(result) =>
                    setEditForm((p) => ({ ...p, result: (result as SsmMedicalControlResult) || undefined }))
                  }
                  allowEmpty
                  emptyLabel="Neselectat"
                  options={CONTROL_RESULTS.map((result) => ({ value: result, label: resultLabel(result) }))}
                />
                <div className="field">
                  <label htmlFor="edit-performed">Efectuat la</label>
                  <input
                    id="edit-performed"
                    value={editForm.performedAt ?? ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, performedAt: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-validity">Valabil până la</label>
                  <input
                    id="edit-validity"
                    value={editForm.validityUntil ?? ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, validityUntil: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-rec">Recomandări</label>
                  <input
                    id="edit-rec"
                    value={editForm.recommendations ?? ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, recommendations: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-sheet">Înlocuire fișă aptitudini</label>
                  <input
                    id="edit-sheet"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setEditAptitudeSheet(e.target.files?.[0])}
                  />
                  {selectedControl.aptitudeSheetName ? (
                    <p className="field-hint">Fișă curentă: {selectedControl.aptitudeSheetName}</p>
                  ) : null}
                </div>
                <button type="submit" className="btn-primary" disabled={updateControl.isPending}>
                  {updateControl.isPending ? "Se actualizează..." : "Salvează modificările"}
                </button>
                {updateControl.isSuccess ? (
                  <p className="feedback success" role="status">
                    Controlul a fost actualizat.
                  </p>
                ) : null}
                {updateControl.isError ? (
                  <p className="feedback error" role="alert">
                    {mutationErrorMessage(updateControl.error)}
                  </p>
                ) : null}
                {downloadError ? <p className="feedback error">{downloadError}</p> : null}
              </form>
            )}
          </div>
        </div>
      ) : null}

      {tab === "reminders" ? (
        <div className="card form-stack ssm-doc-card">
          <div className="ssm-history-list">
            {(remindersQuery.data?.reminders ?? []).map((item) => (
              <div key={item.controlId} className="ssm-history-item">
                <div>
                  <strong>{item.employeeName}</strong>
                  <div className="field-hint">
                    {item.controlTypeName} · termen {item.nextDueAt}
                  </div>
                </div>
                <div className="ssm-inline-actions">
                  <span className={item.daysUntilDue < 0 ? "badge-bad" : "badge-good"}>
                    {item.daysUntilDue < 0
                      ? `Întârziat ${Math.abs(item.daysUntilDue)} zile`
                      : `${item.daysUntilDue} zile`}
                  </span>
                  <button type="button" className="btn-text" onClick={() => selectForUpdate(item.controlId)}>
                    Actualizează
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!remindersQuery.data?.reminders.length ? (
            <p className="field-hint">Nu sunt reminder-uri active momentan.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
