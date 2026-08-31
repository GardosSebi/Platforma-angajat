import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { requireLinkedEmployeeId } from "../../../shared/auth/roles";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { ssmApi } from "../../ssm/api/ssm.api";
import { formatRoDate, mutationErrorMessage } from "../utils";

function resultLabel(result?: string | null): string {
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
      return "Fără rezultat";
  }
}

export function EmployeeMedicalPanel() {
  const session = useAuthSession();
  const employeeId = requireLinkedEmployeeId(session);
  const queryClient = useQueryClient();
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["employee-portal", "medical"],
    queryFn: () => ssmApi.myMedicalSummary(),
    enabled: Boolean(employeeId)
  });

  const requestAppointment = useMutation({
    mutationFn: () =>
      ssmApi.requestMedicalAppointment({
        preferredDate: preferredDate ? new Date(preferredDate).toISOString() : undefined,
        notes: notes.trim() || undefined
      }),
    onSuccess: async () => {
      setNotes("");
      setPreferredDate("");
      await queryClient.invalidateQueries({ queryKey: ["employee-portal", "medical"] });
    }
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    requestAppointment.mutate();
  };

  if (!employeeId) {
    return (
      <div className="employee-portal-empty card">
        <p>Contul tău nu este legat de un profil de angajat.</p>
      </div>
    );
  }

  if (query.isLoading) {
    return <p className="field-hint">Se încarcă situația medicală…</p>;
  }

  if (query.isError) {
    return <p className="feedback error">{mutationErrorMessage(query.error)}</p>;
  }

  const data = query.data;

  return (
    <div className="employee-medical-panel">
      {data?.reminderVisible ? (
        <div className={`employee-portal-alert ${data.blockedAdmission ? "feedback error" : "feedback warn"}`} role="alert">
          <strong>{data.blockedAdmission ? "Blocare admitere:" : "Reminder control medical:"}</strong>{" "}
          {data.blockedAdmission
            ? "aptitudinea medicală blochează admiterea la muncă până la reevaluare."
            : data.daysUntilDue != null && data.daysUntilDue < 0
              ? `controlul este restant de ${Math.abs(data.daysUntilDue)} zile (scadență ${formatRoDate(data.nextDueAt)}).`
              : `următorul control este pe ${formatRoDate(data.nextDueAt)}${
                  data.daysUntilDue != null ? ` (în ${data.daysUntilDue} zile)` : ""
                }.`}
        </div>
      ) : null}

      <section className="card">
        <h3 className="card-title">Situația ta medicală</h3>
        <p>
          Ultimul rezultat: <strong>{resultLabel(data?.lastResult)}</strong>
          {data?.lastControlType ? ` · ${data.lastControlType}` : ""}
          {data?.lastPerformedAt ? ` · ${formatRoDate(data.lastPerformedAt)}` : ""}
        </p>
        <p className="field-hint">
          Următorul control: {data?.nextDueAt ? formatRoDate(data.nextDueAt) : "nu este programat"}
        </p>
      </section>

      <section className="card">
        <h3 className="card-title">Controale</h3>
        {(data?.upcoming ?? []).length === 0 ? (
          <p className="field-hint">Niciun control medical în evidență.</p>
        ) : (
          <ul className="employee-dossier-list">
            {(data?.upcoming ?? []).map((c) => (
              <li key={c.id}>
                <strong>{c.controlTypeName}</strong>
                <span>
                  {resultLabel(c.result)}
                  {c.nextDueAt ? ` · scadență ${formatRoDate(c.nextDueAt)}` : ""}
                  {c.blockedAdmission ? " · blocare admitere" : ""}
                </span>
                {c.hasAptitudeSheet ? (
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => {
                      setDownloadError(null);
                      void downloadWithAuth(
                        ssmApi.getMedicalAptitudeSheetUrl(c.id),
                        c.aptitudeSheetName ?? `fisa-aptitudini-${c.id}.pdf`
                      ).catch((err: unknown) => setDownloadError(mutationErrorMessage(err)));
                    }}
                  >
                    Fișa de aptitudini
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {downloadError ? <p className="feedback error">{downloadError}</p> : null}
      </section>

      <section className="card form-stack">
        <h3 className="card-title">Programare control medical</h3>
        <p className="field-hint">Trimite o cerere către responsabilul SSM. Vei fi anunțat după confirmare.</p>
        <form className="form-stack" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="med-pref">Data preferată</label>
            <input id="med-pref" type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="med-notes">Observații</label>
            <textarea id="med-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button className="btn-primary" type="submit" disabled={requestAppointment.isPending}>
            {requestAppointment.isPending ? "Se trimite…" : "Solicită programare"}
          </button>
          {requestAppointment.isError ? (
            <p className="feedback error">{mutationErrorMessage(requestAppointment.error)}</p>
          ) : null}
          {requestAppointment.isSuccess ? (
            <p className="feedback success">Cererea de programare a fost trimisă.</p>
          ) : null}
        </form>
        {(data?.appointments ?? []).length ? (
          <ul className="employee-dossier-list">
            {data!.appointments.map((item) => (
              <li key={item.id}>
                <strong>{item.status === "REQUESTED" ? "Cerere trimisă" : item.status === "SCHEDULED" ? "Programat" : "Anulat"}</strong>
                <span>
                  {item.preferredDate ? `preferat ${formatRoDate(item.preferredDate)} · ` : ""}
                  {formatRoDate(item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
