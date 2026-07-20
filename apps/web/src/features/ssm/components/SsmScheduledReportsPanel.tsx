import { FormEvent, useMemo, useState } from "react";
import type { SsmReportType } from "@repo/shared-types/ssm";
import {
  SSM_REPORT_CADENCES,
  SSM_REPORT_DELIVERY_FORMATS,
  type CreateSsmScheduledReportRequest,
  type SsmReportCadence,
  type SsmReportDeliveryFormat
} from "@repo/shared-types/ssm-scheduled-reports";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import {
  useCreateScheduledReport,
  useDeleteScheduledReport,
  useScheduledReports,
  useUpdateScheduledReport
} from "../hooks/useSsmOverview";

const REPORT_TYPE_OPTIONS: Array<{ value: SsmReportType; label: string }> = [
  { value: "trainings", label: "Instruiri" },
  { value: "eip", label: "EIP" },
  { value: "medical", label: "Medicina muncii" },
  { value: "documents", label: "Documente & versiuni" },
  { value: "accidents", label: "Accidente" },
  { value: "psi", label: "PSI" },
  { value: "compliance", label: "Conformitate" }
];

const CADENCE_LABELS: Record<SsmReportCadence, string> = {
  DAILY: "Zilnic",
  WEEKLY: "Săptămânal",
  MONTHLY: "Lunar"
};

const FORMAT_LABELS: Record<SsmReportDeliveryFormat, string> = {
  PDF: "PDF",
  XLSX: "Excel (XLSX)",
  BOTH: "PDF + Excel"
};

const DAY_OF_WEEK_OPTIONS = [
  { value: "0", label: "Duminică" },
  { value: "1", label: "Luni" },
  { value: "2", label: "Marți" },
  { value: "3", label: "Miercuri" },
  { value: "4", label: "Joi" },
  { value: "5", label: "Vineri" },
  { value: "6", label: "Sâmbătă" }
];

type FormState = {
  reportType: SsmReportType;
  cadence: SsmReportCadence;
  dayOfWeek: string;
  dayOfMonth: string;
  recipientsCsv: string;
  format: SsmReportDeliveryFormat;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  reportType: "trainings",
  cadence: "WEEKLY",
  dayOfWeek: "1",
  dayOfMonth: "1",
  recipientsCsv: "",
  format: "PDF",
  active: true
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function cadenceSummary(row: {
  cadence: SsmReportCadence;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
}): string {
  if (row.cadence === "DAILY") return "Zilnic";
  if (row.cadence === "WEEKLY") {
    const label = DAY_OF_WEEK_OPTIONS.find((item) => item.value === String(row.dayOfWeek ?? 1))?.label ?? "Luni";
    return `Săptămânal · ${label}`;
  }
  return `Lunar · ziua ${row.dayOfMonth ?? 1}`;
}

function buildPayload(form: FormState): CreateSsmScheduledReportRequest {
  const recipients = form.recipientsCsv
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    reportType: form.reportType,
    cadence: form.cadence,
    dayOfWeek: form.cadence === "WEEKLY" ? Number(form.dayOfWeek) : null,
    dayOfMonth: form.cadence === "MONTHLY" ? Number(form.dayOfMonth) : null,
    recipients,
    format: form.format,
    active: form.active
  };
}

export function SsmScheduledReportsPanel() {
  const schedulesQuery = useScheduledReports();
  const createSchedule = useCreateScheduledReport();
  const updateSchedule = useUpdateScheduledReport();
  const deleteSchedule = useDeleteScheduledReport();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const reportTypeLabel = useMemo(
    () => Object.fromEntries(REPORT_TYPE_OPTIONS.map((item) => [item.value, item.label])),
    []
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    const payload = buildPayload(form);
    if (!payload.recipients.length) {
      setFeedback({ type: "error", message: "Introduceți cel puțin un e-mail destinatar." });
      return;
    }

    createSchedule.mutate(payload, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        setFeedback({ type: "success", message: "Raport programat creat." });
      },
      onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
    });
  };

  const onDeactivate = (id: string) => {
    setFeedback(null);
    updateSchedule.mutate(
      { id, payload: { active: false } },
      {
        onSuccess: () => setFeedback({ type: "success", message: "Programare dezactivată." }),
        onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
      }
    );
  };

  const onDelete = (id: string) => {
    if (!window.confirm("Sigur vrei să ștergi această programare?")) return;
    setFeedback(null);
    deleteSchedule.mutate(id, {
      onSuccess: () => setFeedback({ type: "success", message: "Programare ștearsă." }),
      onError: (error) => setFeedback({ type: "error", message: mutationErrorMessage(error) })
    });
  };

  const schedules = schedulesQuery.data ?? [];

  return (
    <section className="card ssm-doc-card ssm-scheduled-reports" aria-labelledby="ssm-scheduled-reports-title">
      <h3 id="ssm-scheduled-reports-title" className="card-title">
        Rapoarte programate
      </h3>
      <p className="field-hint">
        Trimite automat rapoarte SSM pe e-mail, conform unui calendar zilnic, săptămânal sau lunar.
      </p>

      <form className="form-stack" onSubmit={onSubmit}>
        <div className="ssm-form-grid">
          <FieldSelect
            id="scheduled-report-type"
            label="Tip raport"
            value={form.reportType}
            onChange={(reportType) => setForm((prev) => ({ ...prev, reportType: reportType as SsmReportType }))}
            options={REPORT_TYPE_OPTIONS}
          />
          <FieldSelect
            id="scheduled-report-cadence"
            label="Frecvență"
            value={form.cadence}
            onChange={(cadence) => setForm((prev) => ({ ...prev, cadence: cadence as SsmReportCadence }))}
            options={SSM_REPORT_CADENCES.map((cadence) => ({
              value: cadence,
              label: CADENCE_LABELS[cadence]
            }))}
          />
          {form.cadence === "WEEKLY" ? (
            <FieldSelect
              id="scheduled-report-day-of-week"
              label="Zi săptămână"
              value={form.dayOfWeek}
              onChange={(dayOfWeek) => setForm((prev) => ({ ...prev, dayOfWeek }))}
              options={DAY_OF_WEEK_OPTIONS}
            />
          ) : null}
          {form.cadence === "MONTHLY" ? (
            <div className="field">
              <label htmlFor="scheduled-report-day-of-month">Zi lună (1–28)</label>
              <input
                id="scheduled-report-day-of-month"
                type="number"
                min={1}
                max={28}
                value={form.dayOfMonth}
                onChange={(event) => setForm((prev) => ({ ...prev, dayOfMonth: event.target.value }))}
                required
              />
            </div>
          ) : null}
          <FieldSelect
            id="scheduled-report-format"
            label="Format"
            value={form.format}
            onChange={(format) => setForm((prev) => ({ ...prev, format: format as SsmReportDeliveryFormat }))}
            options={SSM_REPORT_DELIVERY_FORMATS.map((format) => ({
              value: format,
              label: FORMAT_LABELS[format]
            }))}
          />
        </div>

        <div className="field">
          <label htmlFor="scheduled-report-recipients">Destinatari (e-mail, separate prin virgulă) *</label>
          <input
            id="scheduled-report-recipients"
            value={form.recipientsCsv}
            onChange={(event) => setForm((prev) => ({ ...prev, recipientsCsv: event.target.value }))}
            placeholder="ssm@companie.ro, manager@companie.ro"
            required
          />
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
          />
          Activ imediat după creare
        </label>

        <button className="btn-primary" type="submit" disabled={createSchedule.isPending}>
          {createSchedule.isPending ? "Se salvează..." : "Programează raport"}
        </button>
      </form>

      {feedback ? (
        <p className={`feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
          {feedback.message}
        </p>
      ) : null}

      <div className="ssm-doc-items ssm-scheduled-list">
        {schedulesQuery.isLoading ? <p className="field-hint">Se încarcă programările...</p> : null}
        {!schedulesQuery.isLoading && schedules.length === 0 ? (
          <p className="field-hint">Nu există rapoarte programate.</p>
        ) : null}
        {schedules.map((row) => (
          <article key={row.id} className={`ssm-doc-item ${row.active ? "" : "inactive"}`}>
            <div>
              <strong>{reportTypeLabel[row.reportType as SsmReportType] ?? row.reportType}</strong>
              <span>
                {cadenceSummary(row)} · {FORMAT_LABELS[row.format as SsmReportDeliveryFormat] ?? row.format}
              </span>
              <span>{row.recipients.join(", ")}</span>
              <span>
                {row.active ? "Activ" : "Inactiv"} · Următoarea rulare: {formatDate(row.nextRunAt)}
              </span>
            </div>
            <div className="ssm-inline-actions">
              {row.active ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={updateSchedule.isPending}
                  onClick={() => onDeactivate(row.id)}
                >
                  Dezactivează
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary btn-danger"
                disabled={deleteSchedule.isPending}
                onClick={() => onDelete(row.id)}
              >
                Șterge
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
