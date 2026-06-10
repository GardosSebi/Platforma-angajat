import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  CreateSsmMedicalControlRequest,
  CreateSsmMedicalControlTypeRequest,
  SsmMedicalControlResult
} from "@repo/shared-types/ssm";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import { useEmployeeOptions, useJobPositionsLookup } from "../../master-data/hooks/useMasterData";
import {
  useCreateMedicalControl,
  useCreateMedicalControlType,
  useMedicalControls,
  useMedicalControlTypes,
  useMedicalReminders
} from "../hooks/useSsmMedical";

const CONTROL_RESULTS: Array<SsmMedicalControlResult | ""> = ["", "FIT", "FIT_CONDITIONAL", "TEMPORARY_UNFIT", "UNFIT"];

const EMPTY_TYPE: CreateSsmMedicalControlTypeRequest = {
  code: "CTRL-ANUAL",
  name: "Control periodic anual",
  jobPositionId: "",
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

export function SsmMedicalManager() {
  const typesQuery = useMedicalControlTypes();
  const controlsQuery = useMedicalControls();
  const remindersQuery = useMedicalReminders();
  const jobPositionsQuery = useJobPositionsLookup();
  const employeesQuery = useEmployeeOptions();
  const jobPositions = jobPositionsQuery.data?.items ?? [];
  const employeeOptions = employeesQuery.data?.items ?? [];

  const createType = useCreateMedicalControlType();
  const createControl = useCreateMedicalControl();

  const [typeForm, setTypeForm] = useState<CreateSsmMedicalControlTypeRequest>(EMPTY_TYPE);
  const [controlForm, setControlForm] = useState<CreateSsmMedicalControlRequest>(EMPTY_CONTROL);
  const [aptitudeSheet, setAptitudeSheet] = useState<File>();

  useEffect(() => {
    if (!controlForm.employeeId && employeeOptions[0]?.id) {
      setControlForm((prev) => ({ ...prev, employeeId: employeeOptions[0]!.id }));
    }
  }, [employeeOptions, controlForm.employeeId]);

  const typeOptions = typesQuery.data ?? [];
  const selectedTypeName = useMemo(
    () => typeOptions.find((item) => item.id === controlForm.controlTypeId)?.name ?? "-",
    [typeOptions, controlForm.controlTypeId]
  );

  const onCreateType = (event: FormEvent) => {
    event.preventDefault();
    createType.mutate(
      {
        ...typeForm,
        jobPositionId: typeForm.jobPositionId?.trim() ? typeForm.jobPositionId.trim() : undefined
      },
      {
      onSuccess: (created) => {
        setControlForm((prev) => ({ ...prev, controlTypeId: created.id }));
      }
      }
    );
  };

  const onCreateControl = (event: FormEvent) => {
    event.preventDefault();
    createControl.mutate({
      payload: {
        ...controlForm,
        result: controlForm.result || undefined
      },
      aptitudeSheet
    });
  };

  return (
    <section className="ssm-documents" aria-labelledby="medical-title">
      <h2 id="medical-title" className="card-title">
        Medicina muncii (3.7)
      </h2>

      <div className="ssm-doc-grid">
        <form className="card form-stack ssm-doc-card" onSubmit={onCreateType}>
          <h3 className="card-title">Tipuri controale medicale pe post</h3>
          <div className="field">
            <label htmlFor="med-code">Cod control</label>
            <input id="med-code" value={typeForm.code} onChange={(e) => setTypeForm((p) => ({ ...p, code: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="med-name">Denumire control</label>
            <input id="med-name" value={typeForm.name} onChange={(e) => setTypeForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="med-job-position">Post (opțional)</label>
            <select
              id="med-job-position"
              value={typeForm.jobPositionId ?? ""}
              onChange={(e) => setTypeForm((p) => ({ ...p, jobPositionId: e.target.value }))}
            >
              <option value="">Orice post</option>
              {jobPositions.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.code} — {job.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="med-recurrence">Recurență (zile)</label>
            <input
              id="med-recurrence"
              type="number"
              value={typeForm.recurrenceDays ?? 365}
              onChange={(e) => setTypeForm((p) => ({ ...p, recurrenceDays: Number(e.target.value || 365) }))}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={createType.isPending}>
            {createType.isPending ? "Se salvează..." : "Adaugă tip control"}
          </button>
          {createType.isSuccess ? (
            <p className="feedback success" role="status">
              Tipul de control a fost adăugat.
            </p>
          ) : null}
          {createType.isError ? (
            <p className="feedback error" role="alert">
              {mutationErrorMessage(createType.error)}
            </p>
          ) : null}
          <p className="field-hint">Tipuri existente: {typeOptions.map((t) => t.code).join(", ") || "-"}</p>
        </form>

        <form className="card form-stack ssm-doc-card" onSubmit={onCreateControl}>
          <h3 className="card-title">Rezultat control + fișă aptitudini</h3>
          <EmployeeSelect
            id="med-employee"
            value={controlForm.employeeId}
            required
            onChange={(employeeId) => setControlForm((p) => ({ ...p, employeeId }))}
          />
          <div className="field">
            <label htmlFor="med-type">Tip control</label>
            <select
              id="med-type"
              value={controlForm.controlTypeId}
              onChange={(e) => setControlForm((p) => ({ ...p, controlTypeId: e.target.value }))}
            >
              <option value="">Selectează tip</option>
              {typeOptions.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.code} - {type.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="med-scheduled">Programare (ISO)</label>
            <input
              id="med-scheduled"
              value={controlForm.scheduledAt}
              onChange={(e) => setControlForm((p) => ({ ...p, scheduledAt: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="med-performed">Efectuat la (ISO)</label>
            <input
              id="med-performed"
              value={controlForm.performedAt ?? ""}
              onChange={(e) => setControlForm((p) => ({ ...p, performedAt: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="med-result">Rezultat aptitudine</label>
            <select
              id="med-result"
              value={controlForm.result ?? ""}
              onChange={(e) => setControlForm((p) => ({ ...p, result: (e.target.value as SsmMedicalControlResult) || undefined }))}
            >
              {CONTROL_RESULTS.map((result) => (
                <option key={result || "none"} value={result}>
                  {result || "Neselectat"}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="med-validity">Valabil până la (ISO, opțional)</label>
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
          <button type="submit" className="btn-primary" disabled={createControl.isPending || !controlForm.controlTypeId}>
            {createControl.isPending ? "Se salvează..." : "Salvează control medical"}
          </button>
          {createControl.isSuccess ? (
            <p className="feedback success" role="status">
              Controlul medical a fost salvat.
            </p>
          ) : null}
          {createControl.isError ? (
            <p className="feedback error" role="alert">
              {mutationErrorMessage(createControl.error)}
            </p>
          ) : null}
          <p className="field-hint">Tip selectat: {selectedTypeName}</p>
        </form>
      </div>

      <div className="ssm-doc-grid second">
        <div className="card ssm-doc-card">
          <h3 className="card-title">Registru controale medicale</h3>
          <div className="ssm-history-list">
            {(controlsQuery.data?.items ?? []).slice(0, 8).map((item) => (
              <div key={item.id} className="ssm-history-item">
                <div>
                  <strong>{item.employeeName}</strong>
                  <div className="field-hint">
                    {item.controlTypeCode} / {item.controlTypeName} | rezultat {item.result ?? "-"} | scadență{" "}
                    {item.nextDueAt ?? "-"}
                  </div>
                </div>
                <span className={item.result === "UNFIT" || item.result === "TEMPORARY_UNFIT" ? "badge-bad" : "badge-good"}>
                  {item.aptitudeSheetName ? "Fișă atașată" : "Fără fișă"}
                </span>
              </div>
            ))}
          </div>
          {!controlsQuery.data?.items.length ? <p className="field-hint">Nu există controale medicale înregistrate.</p> : null}
        </div>

        <div className="card ssm-doc-card">
          <h3 className="card-title">Reminder controale</h3>
          <div className="ssm-history-list">
            {(remindersQuery.data?.reminders ?? []).slice(0, 8).map((item) => (
              <div key={item.controlId} className="ssm-history-item">
                <div>
                  <strong>{item.employeeName}</strong>
                  <div className="field-hint">
                    {item.controlTypeName} | termen {item.nextDueAt}
                  </div>
                </div>
                <span className={item.daysUntilDue < 0 ? "badge-bad" : "badge-good"}>
                  {item.daysUntilDue < 0 ? `Întârziat ${Math.abs(item.daysUntilDue)} zile` : `${item.daysUntilDue} zile`}
                </span>
              </div>
            ))}
          </div>
          {!remindersQuery.data?.reminders.length ? <p className="field-hint">Nu sunt reminder-uri active pentru acum.</p> : null}
        </div>
      </div>
    </section>
  );
}
