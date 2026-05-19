import { FormEvent, useEffect, useState } from "react";
import type {
  CreateSsmPsiEquipmentRequest,
  CreateSsmPsiResponsibleRequest,
  CreateSsmPsiTrainingRecordRequest,
  RegisterSsmPsiEquipmentVerificationRequest,
  SsmPsiResponsibleRole
} from "@repo/shared-types/ssm";
import { useEmployeeOptions, useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import {
  useCreatePsiEquipment,
  useCreatePsiResponsible,
  useCreatePsiTraining,
  usePsiDocumentation,
  usePsiEquipment,
  usePsiEquipmentNotifications,
  usePsiResponsibles,
  usePsiTrainings,
  useRegisterPsiEquipmentVerification
} from "../hooks/useSsmPsi";

const RESPONSIBLE_ROLES: SsmPsiResponsibleRole[] = [
  "PSI_RESPONSIBLE",
  "EMERGENCY_COORDINATOR",
  "EVACUATION_RESPONSIBLE",
  "FIRST_AID_RESPONSIBLE"
];

const EMPTY_EQUIPMENT: CreateSsmPsiEquipmentRequest = {
  worksiteId: "",
  code: "STING-HQ-01",
  name: "Stingator pulbere P6",
  category: "Stingator",
  location: "Hol acces",
  verificationIntervalDays: 365,
  reminderDays: [30, 15, 7],
  lastVerifiedAt: new Date().toISOString().slice(0, 10),
  notes: ""
};

const EMPTY_VERIFICATION: RegisterSsmPsiEquipmentVerificationRequest = {
  equipmentId: "",
  performedAt: new Date().toISOString().slice(0, 10),
  result: "Verificat conform",
  notes: ""
};

const EMPTY_TRAINING: CreateSsmPsiTrainingRecordRequest = {
  worksiteId: "",
  employeeId: "",
  topic: "Instruire PSI si evacuare",
  conductedAt: new Date().toISOString().slice(0, 10),
  validUntil: "",
  trainerName: "Responsabil PSI",
  responsibleName: "",
  notes: ""
};

const EMPTY_RESPONSIBLE: CreateSsmPsiResponsibleRequest = {
  worksiteId: "",
  employeeId: "",
  role: "PSI_RESPONSIBLE",
  personName: "",
  email: "",
  phone: "",
  active: true,
  notes: ""
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

export function SsmPsiManager() {
  const worksitesLookup = useWorksitesLookup();
  const employeesOptions = useEmployeeOptions();
  const docsQuery = usePsiDocumentation();
  const equipmentQuery = usePsiEquipment();
  const notificationsQuery = usePsiEquipmentNotifications();
  const trainingsQuery = usePsiTrainings();
  const responsiblesQuery = usePsiResponsibles();

  const createEquipment = useCreatePsiEquipment();
  const registerVerification = useRegisterPsiEquipmentVerification();
  const createTraining = useCreatePsiTraining();
  const createResponsible = useCreatePsiResponsible();

  const [equipmentForm, setEquipmentForm] = useState<CreateSsmPsiEquipmentRequest>(EMPTY_EQUIPMENT);
  const [verificationForm, setVerificationForm] = useState<RegisterSsmPsiEquipmentVerificationRequest>(EMPTY_VERIFICATION);
  const [trainingForm, setTrainingForm] = useState<CreateSsmPsiTrainingRecordRequest>(EMPTY_TRAINING);
  const [responsibleForm, setResponsibleForm] = useState<CreateSsmPsiResponsibleRequest>(EMPTY_RESPONSIBLE);

  useEffect(() => {
    const firstWorksite = worksitesLookup.data?.items[0];
    if (!firstWorksite) return;
    setEquipmentForm((prev) => (prev.worksiteId ? prev : { ...prev, worksiteId: firstWorksite.id }));
    setTrainingForm((prev) => (prev.worksiteId ? prev : { ...prev, worksiteId: firstWorksite.id }));
    setResponsibleForm((prev) => (prev.worksiteId ? prev : { ...prev, worksiteId: firstWorksite.id }));
  }, [worksitesLookup.data?.items]);

  useEffect(() => {
    const firstEquipment = equipmentQuery.data?.items[0];
    if (!firstEquipment) return;
    setVerificationForm((prev) => (prev.equipmentId ? prev : { ...prev, equipmentId: firstEquipment.id }));
  }, [equipmentQuery.data?.items]);

  useEffect(() => {
    const firstEmployee = employeesOptions.data?.items[0];
    if (!firstEmployee) return;
    setTrainingForm((prev) => (prev.employeeId ? prev : { ...prev, employeeId: firstEmployee.id }));
    setResponsibleForm((prev) =>
      prev.employeeId || prev.personName
        ? prev
        : {
            ...prev,
            employeeId: firstEmployee.id,
            personName: firstEmployee.fullName,
            email: firstEmployee.email
          }
    );
  }, [employeesOptions.data?.items]);

  const onEquipmentSubmit = (event: FormEvent) => {
    event.preventDefault();
    createEquipment.mutate(equipmentForm, {
      onSuccess: (created) => {
        setVerificationForm((prev) => ({ ...prev, equipmentId: created.id }));
      }
    });
  };

  const onVerificationSubmit = (event: FormEvent) => {
    event.preventDefault();
    registerVerification.mutate(verificationForm);
  };

  const onTrainingSubmit = (event: FormEvent) => {
    event.preventDefault();
    createTraining.mutate({
      ...trainingForm,
      employeeId: trainingForm.employeeId || undefined,
      validUntil: trainingForm.validUntil || undefined
    });
  };

  const onResponsibleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createResponsible.mutate({
      ...responsibleForm,
      employeeId: responsibleForm.employeeId || undefined,
      email: responsibleForm.email || undefined,
      phone: responsibleForm.phone || undefined
    });
  };

  const worksiteCount = worksitesLookup.data?.items.length ?? 0;
  const equipmentCount = equipmentQuery.data?.items.length ?? 0;
  const activeResponsibleCount = (responsiblesQuery.data?.items ?? []).filter((item) => item.active).length;

  return (
    <section className="ssm-documents" aria-labelledby="psi-title">
      <div className="ssm-module-hero">
        <div className="card ssm-hero-card">
          <p className="ssm-card-eyebrow">Partea I · 3.9</p>
          <h2 id="psi-title" className="card-title">
            PSI / urgențe
          </h2>
          <p className="ssm-hero-lead">
            Controlează documentația PSI, inventarul de echipamente, verificările, instruirile și responsabilii dintr-un singur flux.
          </p>
          <div className="ssm-badge-row">
            <span className="ssm-chip">Documentație</span>
            <span className="ssm-chip">Scadențe verificări</span>
            <span className="ssm-chip">Responsabili</span>
          </div>
        </div>

        <div className="ssm-summary-strip">
          <div className="ssm-stat-card">
            <span>Puncte</span>
            <strong>{worksiteCount}</strong>
          </div>
          <div className="ssm-stat-card">
            <span>Echipamente</span>
            <strong>{equipmentCount}</strong>
          </div>
          <div className="ssm-stat-card">
            <span>Responsabili</span>
            <strong>{activeResponsibleCount}</strong>
          </div>
        </div>
      </div>

      <div className="ssm-doc-grid">
        <div className="card ssm-doc-card">
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Documentație PSI per punct de lucru</h3>
              <p className="field-hint">Status rapid pentru dosarul PSI pe fiecare punct.</p>
            </div>
          </div>
          <div className="ssm-doc-items">
            {docsQuery.isLoading ? <p className="field-hint">Se încarcă documentația PSI...</p> : null}
            {(docsQuery.data?.worksites ?? []).map((worksite) => (
              <article key={worksite.id} className="ssm-doc-item">
                <strong>
                  {worksite.code} · {worksite.name}
                </strong>
                <span>{worksite.documents.length ? `${worksite.documents.length} documente PSI` : "Fără document PSI alocat"}</span>
              </article>
            ))}
            {!docsQuery.isLoading && (docsQuery.data?.worksites.length ?? 0) === 0 ? (
              <p className="field-hint">Nu există puncte de lucru active.</p>
            ) : null}
          </div>
          <p className="field-hint">Documentele PSI se adaugă din modulul Documente SSM cu tipul PSI și alocare WORKSITE.</p>
        </div>

        <form className="card form-stack ssm-doc-card" onSubmit={onEquipmentSubmit}>
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Adaugă echipament PSI</h3>
              <p className="field-hint">Cod, locație și interval de verificare.</p>
            </div>
          </div>
          <div className="ssm-form-grid">
            <div className="field wide">
              <label htmlFor="psi-worksite">Punct de lucru</label>
              <select id="psi-worksite" value={equipmentForm.worksiteId} onChange={(e) => setEquipmentForm((p) => ({ ...p, worksiteId: e.target.value }))} required>
                <option value="">Selectează punctul</option>
                {(worksitesLookup.data?.items ?? []).map((worksite) => (
                  <option key={worksite.id} value={worksite.id}>
                    {worksite.code} - {worksite.name}
                  </option>
                ))}
              </select>
              {(worksitesLookup.data?.items?.length ?? 0) === 0 ? <p className="field-hint">Nu există puncte de lucru pentru tenant.</p> : null}
            </div>
            <div className="field">
              <label htmlFor="psi-code">Cod</label>
              <input id="psi-code" value={equipmentForm.code} onChange={(e) => setEquipmentForm((p) => ({ ...p, code: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="psi-name">Denumire</label>
              <input id="psi-name" value={equipmentForm.name} onChange={(e) => setEquipmentForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="psi-location">Locație</label>
              <input id="psi-location" value={equipmentForm.location ?? ""} onChange={(e) => setEquipmentForm((p) => ({ ...p, location: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="psi-interval">Interval verificare (zile)</label>
              <input
                id="psi-interval"
                type="number"
                value={equipmentForm.verificationIntervalDays}
                onChange={(e) => setEquipmentForm((p) => ({ ...p, verificationIntervalDays: Number(e.target.value || 365) }))}
              />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={createEquipment.isPending || !equipmentForm.worksiteId}>
            {createEquipment.isPending ? "Se salvează..." : "Adaugă echipament"}
          </button>
          {createEquipment.isError ? <p className="feedback error">{mutationErrorMessage(createEquipment.error)}</p> : null}
          {createEquipment.isSuccess ? <p className="feedback success">Echipamentul PSI a fost adăugat.</p> : null}
        </form>
      </div>

      <div className="ssm-doc-grid second">
        <form className="card form-stack ssm-doc-card" onSubmit={onVerificationSubmit}>
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Verificare echipament</h3>
              <p className="field-hint">O verificare actualizează automat următoarea scadență.</p>
            </div>
          </div>
          <div className="field">
            <label htmlFor="psi-equipment">Echipament</label>
            <select
              id="psi-equipment"
              value={verificationForm.equipmentId}
              onChange={(e) => setVerificationForm((p) => ({ ...p, equipmentId: e.target.value }))}
              required
            >
              <option value="">Selectează echipamentul</option>
              {(equipmentQuery.data?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
            {(equipmentQuery.data?.items.length ?? 0) === 0 ? <p className="field-hint">Nu există echipamente PSI. Adaugă primul echipament.</p> : null}
          </div>
          <div className="field">
            <label htmlFor="psi-performed">Data verificării</label>
            <input id="psi-performed" type="date" value={verificationForm.performedAt} onChange={(e) => setVerificationForm((p) => ({ ...p, performedAt: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="psi-result">Rezultat</label>
            <input id="psi-result" value={verificationForm.result} onChange={(e) => setVerificationForm((p) => ({ ...p, result: e.target.value }))} />
          </div>
          <button className="btn-primary" type="submit" disabled={registerVerification.isPending || !verificationForm.equipmentId}>
            {registerVerification.isPending ? "Se înregistrează..." : "Înregistrează verificare"}
          </button>
          <p className="field-hint">Notificări active: {notificationsQuery.data?.reminders.length ?? 0}</p>
          {registerVerification.isSuccess ? <p className="feedback success">Verificarea a fost înregistrată.</p> : null}
        </form>

        <div className="card ssm-doc-card">
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Inventar și notificări</h3>
              <p className="field-hint">Reminder-ele apar înainte sau după scadență.</p>
            </div>
            <span className="ssm-chip warn">{notificationsQuery.data?.reminders.length ?? 0} notificări</span>
          </div>
          <div className="ssm-doc-items">
            {(notificationsQuery.data?.reminders ?? []).slice(0, 4).map((item) => (
              <article key={item.equipmentId} className="ssm-doc-item">
                <strong>
                  Reminder · {item.code} · {item.name}
                </strong>
                <span>
                  {item.worksiteName} · {item.daysUntilDue < 0 ? "depășit" : `${item.daysUntilDue} zile`} ·{" "}
                  {new Date(item.nextDueAt).toLocaleDateString()}
                </span>
              </article>
            ))}
            {(equipmentQuery.data?.items ?? []).slice(0, 8).map((item) => (
              <article key={item.id} className="ssm-doc-item">
                <strong>
                  {item.code} · {item.name}
                </strong>
                <span>
                  {item.worksiteName} · scadență {item.nextDueAt ? new Date(item.nextDueAt).toLocaleDateString() : "-"}
                </span>
              </article>
            ))}
            {(equipmentQuery.data?.items.length ?? 0) === 0 ? <p className="field-hint">Inventarul PSI este gol.</p> : null}
          </div>
        </div>
      </div>

      <div className="ssm-doc-grid second">
        <form className="card form-stack ssm-doc-card" onSubmit={onTrainingSubmit}>
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Evidență instruiri PSI</h3>
              <p className="field-hint">Înregistrează instruiri individuale sau colective.</p>
            </div>
          </div>
          <div className="field">
            <label htmlFor="psi-training-worksite">Punct de lucru</label>
            <select id="psi-training-worksite" value={trainingForm.worksiteId} onChange={(e) => setTrainingForm((p) => ({ ...p, worksiteId: e.target.value }))} required>
              <option value="">Selectează punctul</option>
              {(worksitesLookup.data?.items ?? []).map((worksite) => (
                <option key={worksite.id} value={worksite.id}>
                  {worksite.code} - {worksite.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="psi-training-employee">Angajat</label>
            <select id="psi-training-employee" value={trainingForm.employeeId ?? ""} onChange={(e) => setTrainingForm((p) => ({ ...p, employeeId: e.target.value }))}>
              <option value="">Instruire colectivă / fără angajat</option>
              {(employeesOptions.data?.items ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="psi-topic">Temă</label>
            <input id="psi-topic" value={trainingForm.topic} onChange={(e) => setTrainingForm((p) => ({ ...p, topic: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="psi-conducted">Data instruirii</label>
            <input id="psi-conducted" type="date" value={trainingForm.conductedAt} onChange={(e) => setTrainingForm((p) => ({ ...p, conductedAt: e.target.value }))} />
          </div>
          <button className="btn-primary" type="submit" disabled={createTraining.isPending || !trainingForm.worksiteId}>
            {createTraining.isPending ? "Se salvează..." : "Adaugă instruire"}
          </button>
          <p className="field-hint">Înregistrări: {trainingsQuery.data?.items.length ?? 0}</p>
          {createTraining.isSuccess ? <p className="feedback success">Instruirea PSI a fost adăugată.</p> : null}
          <div className="ssm-doc-items">
            {(trainingsQuery.data?.items ?? []).slice(0, 4).map((item) => (
              <article key={item.id} className="ssm-doc-item">
                <strong>{item.topic}</strong>
                <span>
                  {item.worksiteName} · {item.employeeName ?? "colectiv"} · {new Date(item.conductedAt).toLocaleDateString()}
                </span>
              </article>
            ))}
          </div>
        </form>

        <form className="card form-stack ssm-doc-card" onSubmit={onResponsibleSubmit}>
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Responsabili PSI / urgențe</h3>
              <p className="field-hint">Persoane cheie pentru punctul de lucru.</p>
            </div>
          </div>
          <div className="field">
            <label htmlFor="psi-resp-worksite">Punct de lucru</label>
            <select id="psi-resp-worksite" value={responsibleForm.worksiteId} onChange={(e) => setResponsibleForm((p) => ({ ...p, worksiteId: e.target.value }))} required>
              <option value="">Selectează punctul</option>
              {(worksitesLookup.data?.items ?? []).map((worksite) => (
                <option key={worksite.id} value={worksite.id}>
                  {worksite.code} - {worksite.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="psi-role">Rol</label>
            <select id="psi-role" value={responsibleForm.role} onChange={(e) => setResponsibleForm((p) => ({ ...p, role: e.target.value as SsmPsiResponsibleRole }))}>
              {RESPONSIBLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="psi-person">Nume responsabil</label>
            <input id="psi-person" value={responsibleForm.personName} onChange={(e) => setResponsibleForm((p) => ({ ...p, personName: e.target.value }))} required />
          </div>
          <button className="btn-primary" type="submit" disabled={createResponsible.isPending || !responsibleForm.worksiteId}>
            {createResponsible.isPending ? "Se salvează..." : "Adaugă responsabil"}
          </button>
          <p className="field-hint">Responsabili activi: {(responsiblesQuery.data?.items ?? []).filter((item) => item.active).length}</p>
          {createResponsible.isSuccess ? <p className="feedback success">Responsabilul a fost adăugat.</p> : null}
          <div className="ssm-doc-items">
            {(responsiblesQuery.data?.items ?? []).slice(0, 4).map((item) => (
              <article key={item.id} className="ssm-doc-item">
                <strong>{item.personName}</strong>
                <span>
                  {item.role} · {item.worksiteName} · {item.active ? "activ" : "inactiv"}
                </span>
              </article>
            ))}
          </div>
        </form>
      </div>
    </section>
  );
}
