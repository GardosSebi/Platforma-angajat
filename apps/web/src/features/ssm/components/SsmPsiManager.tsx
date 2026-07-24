import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  CreateSsmPsiEquipmentRequest,
  CreateSsmPsiResponsibleRequest,
  CreateSsmPsiTrainingRecordRequest,
  CreateSsmEvacuationDrillRequest,
  RegisterSsmPsiEquipmentVerificationRequest,
  SsmPsiDocKind,
  SsmPsiEquipmentCategory,
  SsmPsiResponsibleRole
} from "@repo/shared-types/ssm";
import { SSM_PSI_EQUIPMENT_CATEGORIES } from "@repo/shared-types/ssm";
import { useEmployeeOptions, useWorksitesLookup } from "../../master-data/hooks/useMasterData";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import {
  useCreatePsiEquipment,
  useCreatePsiResponsible,
  useCreatePsiTraining,
  useDispatchPsiReminders,
  usePsiDocumentation,
  usePsiEquipment,
  usePsiEquipmentNotifications,
  usePsiEquipmentVerifications,
  usePsiResponsibles,
  usePsiTrainings,
  useRegisterPsiEquipmentVerification,
  useRetirePsiEquipment,
  useUpdatePsiEquipment
} from "../hooks/useSsmPsi";
import { useCreateEvacuationDrill, useEvacuationDrills } from "../hooks/useSsmPpp";
import { useTrainingTypes } from "../hooks/useSsmTrainingSuite";

type PsiTab = "docs" | "equipment" | "trainings" | "responsibles" | "drills";
type EquipmentView = "inventory" | "check" | "alerts";

const PSI_TABS: Array<{ id: PsiTab; title: string; caption: string }> = [
  { id: "docs", title: "Documentație", caption: "Acoperire pe punct" },
  { id: "equipment", title: "Echipamente", caption: "Inventar și verificări" },
  { id: "trainings", title: "Instruiri", caption: "Registru + suite PSI" },
  { id: "responsibles", title: "Responsabili", caption: "Roluri pe punct" },
  { id: "drills", title: "Evacuare", caption: "Exerciții înregistrate" }
];

const RESPONSIBLE_ROLES: Array<{ value: SsmPsiResponsibleRole; label: string }> = [
  { value: "PSI_RESPONSIBLE", label: "Responsabil PSI" },
  { value: "EMERGENCY_COORDINATOR", label: "Coordonator urgență" },
  { value: "EVACUATION_RESPONSIBLE", label: "Responsabil evacuare" },
  { value: "FIRST_AID_RESPONSIBLE", label: "Prim ajutor" }
];

const CATEGORY_LABELS: Record<SsmPsiEquipmentCategory, string> = {
  EXTINGUISHER: "Stingător",
  HYDRANT: "Hidrant",
  DETECTION_SYSTEM: "Sistem detecție",
  OTHER: "Altele"
};

const DOC_KIND_LABELS: Record<SsmPsiDocKind, string> = {
  INSTRUCTIONS: "Instrucțiuni PSI",
  EVACUATION_PLAN: "Plan evacuare",
  INTERVENTION: "Organizare intervenție",
  OTHER: "Alte documente"
};

const EMPTY_EQUIPMENT: CreateSsmPsiEquipmentRequest = {
  worksiteId: "",
  code: "",
  name: "",
  category: "EXTINGUISHER",
  location: "",
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
  trainingTypeId: "",
  topic: "Instruire PSI și evacuare",
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

const EMPTY_EVACUATION: CreateSsmEvacuationDrillRequest = {
  worksiteId: "",
  conductedAt: new Date().toISOString().slice(0, 10),
  nextDueAt: "",
  durationMinutes: 30,
  participantsCount: 0,
  result: "Reușită",
  coordinatorName: "",
  notes: ""
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function formatRoDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ro-RO");
}

export function SsmPsiManager() {
  const [tab, setTab] = useState<PsiTab>("docs");
  const [equipmentView, setEquipmentView] = useState<EquipmentView>("inventory");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>();
  const [editLocation, setEditLocation] = useState("");
  const [showCreateEquipment, setShowCreateEquipment] = useState(false);

  const worksitesLookup = useWorksitesLookup();
  const employeesOptions = useEmployeeOptions();
  const trainingTypesQuery = useTrainingTypes();
  const docsQuery = usePsiDocumentation();
  const equipmentQuery = usePsiEquipment();
  const notificationsQuery = usePsiEquipmentNotifications();
  const verificationsQuery = usePsiEquipmentVerifications(selectedEquipmentId);
  const trainingsQuery = usePsiTrainings();
  const responsiblesQuery = usePsiResponsibles();
  const evacuationQuery = useEvacuationDrills();

  const createEquipment = useCreatePsiEquipment();
  const updateEquipment = useUpdatePsiEquipment();
  const retireEquipment = useRetirePsiEquipment();
  const registerVerification = useRegisterPsiEquipmentVerification();
  const dispatchReminders = useDispatchPsiReminders();
  const createTraining = useCreatePsiTraining();
  const createResponsible = useCreatePsiResponsible();
  const createEvacuation = useCreateEvacuationDrill();

  const [equipmentForm, setEquipmentForm] = useState(EMPTY_EQUIPMENT);
  const [verificationForm, setVerificationForm] = useState(EMPTY_VERIFICATION);
  const [trainingForm, setTrainingForm] = useState(EMPTY_TRAINING);
  const [responsibleForm, setResponsibleForm] = useState(EMPTY_RESPONSIBLE);
  const [evacuationForm, setEvacuationForm] = useState(EMPTY_EVACUATION);

  const activeTabMeta = PSI_TABS.find((item) => item.id === tab) ?? PSI_TABS[0];

  const worksiteOptions = mapToOptions(
    worksitesLookup.data?.items ?? [],
    (item) => item.id,
    (item) => `${item.code} — ${item.name}`
  );

  const emergencyTypes = useMemo(
    () => (trainingTypesQuery.data ?? []).filter((item) => item.category === "EMERGENCY_PSI" && item.active),
    [trainingTypesQuery.data]
  );

  const equipmentItems = equipmentQuery.data?.items ?? [];
  const selectedEquipment = equipmentItems.find((item) => item.id === selectedEquipmentId);
  const alertCount = notificationsQuery.data?.reminders.length ?? 0;

  useEffect(() => {
    const firstWorksite = worksitesLookup.data?.items[0];
    if (!firstWorksite) return;
    setEquipmentForm((prev) => (prev.worksiteId ? prev : { ...prev, worksiteId: firstWorksite.id }));
    setTrainingForm((prev) => (prev.worksiteId ? prev : { ...prev, worksiteId: firstWorksite.id }));
    setResponsibleForm((prev) => (prev.worksiteId ? prev : { ...prev, worksiteId: firstWorksite.id }));
    setEvacuationForm((prev) => (prev.worksiteId ? prev : { ...prev, worksiteId: firstWorksite.id }));
  }, [worksitesLookup.data?.items]);

  useEffect(() => {
    if (!equipmentItems.length) return;
    if (selectedEquipmentId && equipmentItems.some((item) => item.id === selectedEquipmentId)) return;
    setSelectedEquipmentId(equipmentItems[0].id);
  }, [equipmentItems, selectedEquipmentId]);

  useEffect(() => {
    if (!selectedEquipment) return;
    setVerificationForm((prev) => ({ ...prev, equipmentId: selectedEquipment.id }));
    setEditLocation(selectedEquipment.location ?? "");
  }, [selectedEquipment]);

  useEffect(() => {
    const firstEmergency = emergencyTypes[0];
    if (!firstEmergency) return;
    setTrainingForm((prev) =>
      prev.trainingTypeId ? prev : { ...prev, trainingTypeId: firstEmergency.id, topic: firstEmergency.name }
    );
  }, [emergencyTypes]);

  const onEquipmentSubmit = (event: FormEvent) => {
    event.preventDefault();
    createEquipment.mutate(equipmentForm, {
      onSuccess: (created) => {
        setSelectedEquipmentId(created.id);
        setShowCreateEquipment(false);
        setEquipmentForm((prev) => ({ ...EMPTY_EQUIPMENT, worksiteId: prev.worksiteId }));
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
      trainingTypeId: trainingForm.trainingTypeId || undefined,
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

  const onEvacuationSubmit = (event: FormEvent) => {
    event.preventDefault();
    createEvacuation.mutate({
      ...evacuationForm,
      nextDueAt: evacuationForm.nextDueAt || undefined,
      coordinatorName: evacuationForm.coordinatorName || undefined,
      notes: evacuationForm.notes || undefined
    });
  };

  const openEquipmentCheck = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId);
    setEquipmentView("check");
  };

  return (
    <section className="ssm-eip-panel" aria-label="Modul PSI / urgențe">
      <div
        className="ssm-panel-tabs ssm-panel-tabs--5"
        role="tablist"
        aria-label="Secțiuni PSI"
      >
        {PSI_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`ssm-panel-tab ${tab === item.id ? "active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            <strong>{item.title}</strong>
            <span>
              {item.id === "equipment" && alertCount > 0
                ? `${item.caption} · ${alertCount} alerte`
                : item.caption}
            </span>
          </button>
        ))}
      </div>

      <header className="ssm-panel-header">
        <h3 className="card-title">{activeTabMeta.title}</h3>
        <p className="field-hint">{activeTabMeta.caption}</p>
      </header>

      {tab === "docs" ? (
        <div className="ssm-panel-layout ssm-panel-layout--single">
          <div className="card form-stack ssm-doc-card">
            <p className="field-hint">
              Documentele sunt grupate pe tip. Upload-ul rămâne în modulul Documente SSM.
            </p>
            <div className="ssm-history-list">
              {(docsQuery.data?.worksites ?? []).map((worksite) => (
                <div key={worksite.id} className="ssm-history-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
                    <strong>
                      {worksite.code} — {worksite.name}
                    </strong>
                    <div className="ssm-badge-row" style={{ margin: 0 }}>
                      <span className={`ssm-chip ${worksite.coverage.instructions ? "good" : "bad"}`}>
                        Instrucțiuni
                      </span>
                      <span className={`ssm-chip ${worksite.coverage.evacuationPlan ? "good" : "bad"}`}>
                        Evacuare
                      </span>
                      <span className={`ssm-chip ${worksite.coverage.intervention ? "good" : "bad"}`}>
                        Intervenție
                      </span>
                    </div>
                  </div>
                  {worksite.documents.length ? (
                    <div className="ssm-history-list" style={{ marginTop: "0.55rem" }}>
                      {worksite.documents.map((doc) => (
                        <div key={doc.id} className="ssm-history-item">
                          <div>
                            <strong>{doc.title}</strong>
                            <div className="field-hint">
                              {DOC_KIND_LABELS[doc.kind]} · v{doc.activeVersionNumber ?? "—"} ·{" "}
                              {formatRoDate(doc.updatedAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="field-hint">Niciun document PSI/urgență pe acest punct.</p>
                  )}
                </div>
              ))}
              {docsQuery.isLoading ? <p className="field-hint">Se încarcă documentația…</p> : null}
              {!docsQuery.isLoading && !(docsQuery.data?.worksites.length ?? 0) ? (
                <p className="field-hint">Nu există puncte de lucru.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "equipment" ? (
        <>
          <div className="ssm-inline-actions" style={{ marginBottom: "0.85rem" }}>
            {(
              [
                { id: "inventory", label: "Inventar" },
                { id: "check", label: "Verificare" },
                { id: "alerts", label: alertCount ? `Alerte (${alertCount})` : "Alerte" }
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                className={equipmentView === item.id ? "btn-primary" : "btn-secondary"}
                onClick={() => setEquipmentView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {equipmentView === "inventory" ? (
            <div className="ssm-panel-layout">
              <div className="card form-stack ssm-doc-card">
                <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
                  <h4 className="card-title" style={{ margin: 0 }}>
                    Inventar activ
                  </h4>
                  <button type="button" className="btn-primary" onClick={() => setShowCreateEquipment((v) => !v)}>
                    {showCreateEquipment ? "Ascunde formular" : "Echipament nou"}
                  </button>
                </div>
                <div className="ssm-history-list">
                  {equipmentItems.map((item) => (
                    <div key={item.id} className="ssm-history-item">
                      <div>
                        <strong>
                          {item.code} — {item.name}
                        </strong>
                        <div className="field-hint">
                          {CATEGORY_LABELS[item.category]} · {item.location || "fără locație"} · scadență{" "}
                          {formatRoDate(item.nextDueAt)}
                        </div>
                      </div>
                      <button type="button" className="btn-secondary" onClick={() => openEquipmentCheck(item.id)}>
                        Verifică
                      </button>
                    </div>
                  ))}
                  {!equipmentItems.length ? <p className="field-hint">Nu există echipamente PSI.</p> : null}
                </div>
              </div>

              {showCreateEquipment ? (
                <form className="card form-stack ssm-doc-card" onSubmit={onEquipmentSubmit}>
                  <h4 className="card-title">Echipament nou</h4>
                  <FieldSelect
                    id="psi-eq-worksite"
                    label="Punct de lucru"
                    value={equipmentForm.worksiteId}
                    onChange={(worksiteId) => setEquipmentForm((prev) => ({ ...prev, worksiteId }))}
                    options={worksiteOptions}
                    required
                  />
                  <FieldSelect
                    id="psi-eq-category"
                    label="Categorie"
                    value={equipmentForm.category}
                    onChange={(category) =>
                      setEquipmentForm((prev) => ({ ...prev, category: category as SsmPsiEquipmentCategory }))
                    }
                    options={SSM_PSI_EQUIPMENT_CATEGORIES.map((value) => ({
                      value,
                      label: CATEGORY_LABELS[value]
                    }))}
                  />
                  <div className="field">
                    <label htmlFor="psi-eq-code">Cod</label>
                    <input
                      id="psi-eq-code"
                      required
                      value={equipmentForm.code}
                      onChange={(event) => setEquipmentForm((prev) => ({ ...prev, code: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="psi-eq-name">Denumire</label>
                    <input
                      id="psi-eq-name"
                      required
                      value={equipmentForm.name}
                      onChange={(event) => setEquipmentForm((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="psi-eq-location">Locație</label>
                    <input
                      id="psi-eq-location"
                      value={equipmentForm.location ?? ""}
                      onChange={(event) => setEquipmentForm((prev) => ({ ...prev, location: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="psi-eq-interval">Interval verificare (zile)</label>
                    <input
                      id="psi-eq-interval"
                      type="number"
                      min={1}
                      required
                      value={equipmentForm.verificationIntervalDays}
                      onChange={(event) =>
                        setEquipmentForm((prev) => ({
                          ...prev,
                          verificationIntervalDays: Number(event.target.value) || 1
                        }))
                      }
                    />
                  </div>
                  <button className="btn-primary" type="submit" disabled={createEquipment.isPending}>
                    {createEquipment.isPending ? "Se salvează…" : "Salvează echipamentul"}
                  </button>
                  {createEquipment.isError ? (
                    <p className="feedback error">{mutationErrorMessage(createEquipment.error)}</p>
                  ) : null}
                </form>
              ) : null}
            </div>
          ) : null}

          {equipmentView === "check" ? (
            <div className="ssm-panel-layout">
              {selectedEquipment ? (
                <div className="card form-stack ssm-doc-card">
                  <h4 className="card-title">
                    {selectedEquipment.code} — {selectedEquipment.name}
                  </h4>
                  <p className="field-hint">
                    {CATEGORY_LABELS[selectedEquipment.category]} · {selectedEquipment.worksiteName} · ultima verificare{" "}
                    {formatRoDate(selectedEquipment.lastVerifiedAt)}
                  </p>

                  <div className="field">
                    <label htmlFor="psi-edit-location">Locație</label>
                    <input
                      id="psi-edit-location"
                      value={editLocation}
                      onChange={(event) => setEditLocation(event.target.value)}
                    />
                  </div>
                  <div className="ssm-inline-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={updateEquipment.isPending}
                      onClick={() =>
                        updateEquipment.mutate({
                          equipmentId: selectedEquipment.id,
                          payload: { location: editLocation }
                        })
                      }
                    >
                      Salvează locația
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={retireEquipment.isPending || selectedEquipment.status === "RETIRED"}
                      onClick={() => retireEquipment.mutate(selectedEquipment.id)}
                    >
                      Retrage
                    </button>
                  </div>

                  <form className="form-stack" onSubmit={onVerificationSubmit}>
                    <h4 className="card-title">Verificare nouă</h4>
                    <div className="field">
                      <label htmlFor="psi-ver-date">Data</label>
                      <input
                        id="psi-ver-date"
                        type="date"
                        required
                        value={verificationForm.performedAt}
                        onChange={(event) =>
                          setVerificationForm((prev) => ({ ...prev, performedAt: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="psi-ver-result">Rezultat</label>
                      <input
                        id="psi-ver-result"
                        required
                        value={verificationForm.result}
                        onChange={(event) =>
                          setVerificationForm((prev) => ({ ...prev, result: event.target.value }))
                        }
                      />
                    </div>
                    <button className="btn-primary" type="submit" disabled={registerVerification.isPending}>
                      {registerVerification.isPending ? "Se salvează…" : "Salvează verificarea"}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="card ssm-doc-card">
                  <p className="field-hint">Alege un echipament din Inventar.</p>
                </div>
              )}

              <div className="card form-stack ssm-doc-card">
                <h4 className="card-title">Istoric verificări</h4>
                <div className="ssm-history-list">
                  {(verificationsQuery.data?.items ?? []).map((item) => (
                    <div key={item.id} className="ssm-history-item">
                      <div>
                        <strong>{formatRoDate(item.performedAt)}</strong>
                        <div className="field-hint">
                          {item.result} · următoarea {formatRoDate(item.nextDueAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!verificationsQuery.isLoading && (verificationsQuery.data?.items.length ?? 0) === 0 ? (
                    <p className="field-hint">Nicio verificare încă.</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {equipmentView === "alerts" ? (
            <div className="ssm-panel-layout ssm-panel-layout--single">
              <div className="card form-stack ssm-doc-card">
                <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
                  <h4 className="card-title" style={{ margin: 0 }}>
                    Scadențe echipamente
                  </h4>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={dispatchReminders.isPending}
                    onClick={() => dispatchReminders.mutate()}
                  >
                    {dispatchReminders.isPending ? "Se trimit…" : "Trimite reminder-ele"}
                  </button>
                </div>
                {dispatchReminders.isSuccess ? (
                  <p className="field-hint">
                    Trimise {dispatchReminders.data.sent} din {dispatchReminders.data.candidates} (email{" "}
                    {dispatchReminders.data.sentEmail}, in-app {dispatchReminders.data.sentInApp}).
                  </p>
                ) : null}
                <div className="ssm-history-list">
                  {(notificationsQuery.data?.reminders ?? []).map((item) => (
                    <div key={item.equipmentId} className="ssm-history-item">
                      <div>
                        <strong>
                          {item.code} — {item.name}
                        </strong>
                        <div className="field-hint">
                          {item.worksiteName} ·{" "}
                          {item.daysUntilDue < 0
                            ? `restant ${Math.abs(item.daysUntilDue)} zile`
                            : `în ${item.daysUntilDue} zile`}{" "}
                          · {formatRoDate(item.nextDueAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!alertCount ? <p className="field-hint">Nicio alertă activă.</p> : null}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "trainings" ? (
        <div className="ssm-panel-layout">
          <form className="card form-stack ssm-doc-card" onSubmit={onTrainingSubmit}>
            <h4 className="card-title">Înregistrare în registrul PSI</h4>
            <FieldSelect
              id="psi-tr-worksite"
              label="Punct de lucru"
              value={trainingForm.worksiteId}
              onChange={(worksiteId) => setTrainingForm((prev) => ({ ...prev, worksiteId }))}
              options={worksiteOptions}
              required
            />
            <EmployeeSelect
              id="psi-tr-employee"
              value={trainingForm.employeeId ?? ""}
              onChange={(employeeId) => setTrainingForm((prev) => ({ ...prev, employeeId }))}
            />
            <FieldSelect
              id="psi-tr-type"
              label="Tip suite EMERGENCY_PSI"
              value={trainingForm.trainingTypeId ?? ""}
              onChange={(trainingTypeId) => {
                const selected = emergencyTypes.find((item) => item.id === trainingTypeId);
                setTrainingForm((prev) => ({
                  ...prev,
                  trainingTypeId,
                  topic: selected?.name ?? prev.topic
                }));
              }}
              allowEmpty
              emptyLabel="Fără legătură la suite"
              options={mapToOptions(emergencyTypes, (item) => item.id, (item) => item.name)}
            />
            <div className="field">
              <label htmlFor="psi-tr-topic">Temă</label>
              <input
                id="psi-tr-topic"
                required
                value={trainingForm.topic}
                onChange={(event) => setTrainingForm((prev) => ({ ...prev, topic: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="psi-tr-date">Data</label>
              <input
                id="psi-tr-date"
                type="date"
                required
                value={trainingForm.conductedAt}
                onChange={(event) => setTrainingForm((prev) => ({ ...prev, conductedAt: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="psi-tr-trainer">Trainer</label>
              <input
                id="psi-tr-trainer"
                required
                value={trainingForm.trainerName}
                onChange={(event) => setTrainingForm((prev) => ({ ...prev, trainerName: event.target.value }))}
              />
            </div>
            <button className="btn-primary" type="submit" disabled={createTraining.isPending}>
              {createTraining.isPending ? "Se salvează…" : "Salvează"}
            </button>
            {createTraining.isError ? (
              <p className="feedback error">{mutationErrorMessage(createTraining.error)}</p>
            ) : null}
          </form>

          <div className="card form-stack ssm-doc-card">
            <h4 className="card-title">Evidență unificată</h4>
            <p className="field-hint">Registru PSI + planuri din suite EMERGENCY_PSI.</p>
            <div className="ssm-history-list">
              {(trainingsQuery.data?.items ?? []).map((item) => (
                <div key={`${item.source}-${item.id}`} className="ssm-history-item">
                  <div>
                    <strong>{item.topic}</strong>
                    <div className="field-hint">
                      {item.source === "TRAINING_SUITE" ? "Suite" : "Registru"} · {item.employeeName ?? "colectiv"} ·{" "}
                      {item.worksiteName} · {formatRoDate(item.conductedAt)}
                    </div>
                  </div>
                </div>
              ))}
              {!trainingsQuery.isLoading && (trainingsQuery.data?.items.length ?? 0) === 0 ? (
                <p className="field-hint">Nu există instruiri.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "responsibles" ? (
        <div className="ssm-panel-layout">
          <form className="card form-stack ssm-doc-card" onSubmit={onResponsibleSubmit}>
            <h4 className="card-title">Adaugă responsabil</h4>
            <FieldSelect
              id="psi-resp-worksite"
              label="Punct de lucru"
              value={responsibleForm.worksiteId}
              onChange={(worksiteId) => setResponsibleForm((prev) => ({ ...prev, worksiteId }))}
              options={worksiteOptions}
              required
            />
            <FieldSelect
              id="psi-resp-role"
              label="Rol"
              value={responsibleForm.role}
              onChange={(role) => setResponsibleForm((prev) => ({ ...prev, role: role as SsmPsiResponsibleRole }))}
              options={RESPONSIBLE_ROLES}
            />
            <EmployeeSelect
              id="psi-resp-employee"
              value={responsibleForm.employeeId ?? ""}
              onChange={(employeeId) => {
                const employee = employeesOptions.data?.items.find((item) => item.id === employeeId);
                setResponsibleForm((prev) => ({
                  ...prev,
                  employeeId,
                  personName: employee?.fullName ?? prev.personName,
                  email: employee?.email ?? prev.email
                }));
              }}
            />
            <div className="field">
              <label htmlFor="psi-resp-name">Nume</label>
              <input
                id="psi-resp-name"
                required
                value={responsibleForm.personName}
                onChange={(event) => setResponsibleForm((prev) => ({ ...prev, personName: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="psi-resp-email">Email (reminder-e)</label>
              <input
                id="psi-resp-email"
                type="email"
                value={responsibleForm.email ?? ""}
                onChange={(event) => setResponsibleForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <button className="btn-primary" type="submit" disabled={createResponsible.isPending}>
              {createResponsible.isPending ? "Se salvează…" : "Adaugă"}
            </button>
            {createResponsible.isError ? (
              <p className="feedback error">{mutationErrorMessage(createResponsible.error)}</p>
            ) : null}
          </form>

          <div className="card form-stack ssm-doc-card">
            <h4 className="card-title">Activi pe puncte</h4>
            <div className="ssm-history-list">
              {(responsiblesQuery.data?.items ?? [])
                .filter((item) => item.active)
                .map((item) => (
                  <div key={item.id} className="ssm-history-item">
                    <div>
                      <strong>{item.personName}</strong>
                      <div className="field-hint">
                        {RESPONSIBLE_ROLES.find((role) => role.value === item.role)?.label ?? item.role} ·{" "}
                        {item.worksiteName}
                        {item.email ? ` · ${item.email}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              {(responsiblesQuery.data?.items ?? []).filter((item) => item.active).length === 0 ? (
                <p className="field-hint">Nu există responsabili activi.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "drills" ? (
        <div className="ssm-panel-layout">
          <form className="card form-stack ssm-doc-card" onSubmit={onEvacuationSubmit}>
            <h4 className="card-title">Exercițiu nou</h4>
            <FieldSelect
              id="psi-drill-worksite"
              label="Punct de lucru"
              value={evacuationForm.worksiteId}
              onChange={(worksiteId) => setEvacuationForm((prev) => ({ ...prev, worksiteId }))}
              options={worksiteOptions}
              required
            />
            <div className="field">
              <label htmlFor="psi-drill-date">Data</label>
              <input
                id="psi-drill-date"
                type="date"
                required
                value={evacuationForm.conductedAt}
                onChange={(event) => setEvacuationForm((prev) => ({ ...prev, conductedAt: event.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="psi-drill-result">Rezultat</label>
              <input
                id="psi-drill-result"
                required
                value={evacuationForm.result}
                onChange={(event) => setEvacuationForm((prev) => ({ ...prev, result: event.target.value }))}
              />
            </div>
            <button className="btn-primary" type="submit" disabled={createEvacuation.isPending}>
              {createEvacuation.isPending ? "Se salvează…" : "Salvează"}
            </button>
            {createEvacuation.isError ? (
              <p className="feedback error">{mutationErrorMessage(createEvacuation.error)}</p>
            ) : null}
          </form>

          <div className="card form-stack ssm-doc-card">
            <h4 className="card-title">Istoric</h4>
            <div className="ssm-history-list">
              {(evacuationQuery.data?.items ?? []).map((item) => (
                <div key={item.id} className="ssm-history-item">
                  <div>
                    <strong>{item.worksiteName}</strong>
                    <div className="field-hint">
                      {formatRoDate(item.conductedAt)} · {item.result}
                      {item.nextDueAt ? ` · următorul ${formatRoDate(item.nextDueAt)}` : ""}
                    </div>
                  </div>
                </div>
              ))}
              {!evacuationQuery.isLoading && (evacuationQuery.data?.items.length ?? 0) === 0 ? (
                <p className="field-hint">Nu există exerciții înregistrate.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
