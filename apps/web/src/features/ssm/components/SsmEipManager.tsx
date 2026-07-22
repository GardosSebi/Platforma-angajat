import { FormEvent, useEffect, useState } from "react";
import type {
  CreateSsmEipMovementRequest,
  CreateSsmEipNormRequest,
  CreateSsmEipTypeRequest,
  SsmEipMovementType
} from "@repo/shared-types/ssm";
import {
  useEipNorms,
  useEipNotifications,
  useEipRegister,
  useEipStockGap,
  useEipTypes,
  useCreateEipType,
  useDispatchEipNotifications,
  useRegisterEipMovement,
  useUpsertEipNorm
} from "../hooks/useSsmEip";
import { SignatureCanvas } from "../../../shared/components/SignatureCanvas";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions } from "../../../shared/components/field-select-options";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import {
  useDepartmentsLookup,
  useEmployeeOptions,
  useJobPositionsLookup,
  useWorksitesLookup
} from "../../master-data/hooks/useMasterData";
import { downloadWithAuth } from "../../../shared/api/http-download";
import { ssmApi } from "../api/ssm.api";

type EipPanelTab = "types" | "norms" | "movements" | "reports";

const EIP_TABS: Array<{ id: EipPanelTab; title: string; caption: string }> = [
  { id: "types", title: "Catalog tipuri", caption: "Cod, denumire, durată" },
  { id: "norms", title: "Normativ pe post", caption: "Cantitate și înlocuire" },
  { id: "movements", title: "Mișcări & registru", caption: "Stoc, distribuție, semnătură" },
  { id: "reports", title: "Scadențe & stoc", caption: "Reminder și gap report" }
];

const EMPTY_TYPE: CreateSsmEipTypeRequest = {
  code: "CASCA",
  name: "Casca protectie",
  defaultLifetimeDays: 365
};

const EMPTY_NORM: CreateSsmEipNormRequest = {
  jobPositionId: "",
  eipTypeId: "",
  requiredQuantity: 1,
  lifetimeDays: 365,
  replacementRule: "La uzura sau la 12 luni"
};

const EMPTY_MOVEMENT: CreateSsmEipMovementRequest = {
  employeeId: "",
  eipTypeId: "",
  worksiteId: "",
  departmentId: "",
  movementType: "DISTRIBUTION",
  quantity: 1,
  notes: "",
  signatureData: ""
};

const MOVEMENT_TYPES: SsmEipMovementType[] = ["INTAKE", "DISTRIBUTION", "RETURN", "SCRAP"];

const MOVEMENT_TYPE_LABELS: Record<SsmEipMovementType, string> = {
  INTAKE: "Receptie / aprovizionare",
  DISTRIBUTION: "Distributie",
  RETURN: "Returnare",
  SCRAP: "Casare"
};

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function locationLabel(worksiteName?: string | null, departmentName?: string | null): string {
  const parts = [worksiteName, departmentName].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Global";
}

export function SsmEipManager() {
  const [tab, setTab] = useState<EipPanelTab>("types");

  const typesQuery = useEipTypes();
  const jobPositionsQuery = useJobPositionsLookup();
  const worksitesQuery = useWorksitesLookup();
  const departmentsQuery = useDepartmentsLookup();
  const employeeOptionsQuery = useEmployeeOptions();
  const jobPositions = jobPositionsQuery.data?.items ?? [];
  const worksites = worksitesQuery.data?.items ?? [];
  const departments = departmentsQuery.data?.items ?? [];
  const employeeOptions = employeeOptionsQuery.data?.items ?? [];
  const normsQuery = useEipNorms();
  const registerQuery = useEipRegister();
  const notificationsQuery = useEipNotifications();
  const stockGapQuery = useEipStockGap();
  const dispatchNotifications = useDispatchEipNotifications();

  const createType = useCreateEipType();
  const upsertNorm = useUpsertEipNorm();
  const registerMovement = useRegisterEipMovement();

  const [typeForm, setTypeForm] = useState<CreateSsmEipTypeRequest>(EMPTY_TYPE);
  const [normForm, setNormForm] = useState<CreateSsmEipNormRequest>(EMPTY_NORM);
  const [movementForm, setMovementForm] = useState<CreateSsmEipMovementRequest>(EMPTY_MOVEMENT);

  const isIntake = movementForm.movementType === "INTAKE";
  const activeTabMeta = EIP_TABS.find((item) => item.id === tab) ?? EIP_TABS[0];

  useEffect(() => {
    if (!isIntake && !movementForm.employeeId && employeeOptions[0]?.id) {
      setMovementForm((prev) => ({ ...prev, employeeId: employeeOptions[0]!.id }));
    }
  }, [employeeOptions, isIntake, movementForm.employeeId]);

  const onTypeSubmit = (event: FormEvent) => {
    event.preventDefault();
    createType.mutate(typeForm, {
      onSuccess: (created) => {
        setNormForm((prev) => ({ ...prev, eipTypeId: created.id }));
        setMovementForm((prev) => ({ ...prev, eipTypeId: created.id }));
      }
    });
  };

  const onNormSubmit = (event: FormEvent) => {
    event.preventDefault();
    upsertNorm.mutate(normForm);
  };

  const onMovementSubmit = (event: FormEvent) => {
    event.preventDefault();
    const payload: CreateSsmEipMovementRequest = {
      eipTypeId: movementForm.eipTypeId,
      movementType: movementForm.movementType,
      quantity: movementForm.quantity,
      notes: movementForm.notes || undefined,
      worksiteId: movementForm.worksiteId || undefined,
      departmentId: movementForm.departmentId || undefined,
      ...(isIntake
        ? {}
        : {
            employeeId: movementForm.employeeId,
            signatureData: movementForm.signatureData || undefined
          })
    };
    registerMovement.mutate(payload);
  };

  const loadError =
    typesQuery.error ?? jobPositionsQuery.error ?? normsQuery.error ?? registerQuery.error;
  const loadErrorMessage = loadError instanceof Error ? loadError.message : null;

  const canSubmitMovement =
    Boolean(movementForm.eipTypeId) &&
    (isIntake
      ? Boolean(movementForm.worksiteId || movementForm.departmentId)
      : Boolean(movementForm.employeeId && movementForm.signatureData?.startsWith("data:image")));

  return (
    <section className="ssm-eip-panel" aria-label="Modul EIP">
      <div className="ssm-panel-tabs" role="tablist" aria-label="Secțiuni EIP">
        {EIP_TABS.map((item) => (
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

      {loadErrorMessage ? (
        <p className="feedback error" role="alert">
          {loadErrorMessage}
        </p>
      ) : null}

      {tab === "types" ? (
        <div className="ssm-panel-layout">
          <form className="card form-stack ssm-doc-card" onSubmit={onTypeSubmit}>
            <div className="field">
              <label htmlFor="eip-code">Cod</label>
              <input
                id="eip-code"
                value={typeForm.code}
                onChange={(e) => setTypeForm((p) => ({ ...p, code: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="eip-name">Denumire</label>
              <input
                id="eip-name"
                value={typeForm.name}
                onChange={(e) => setTypeForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="eip-life">Durată implicită (zile)</label>
              <input
                id="eip-life"
                type="number"
                value={typeForm.defaultLifetimeDays ?? 365}
                onChange={(e) =>
                  setTypeForm((p) => ({ ...p, defaultLifetimeDays: Number(e.target.value || 365) }))
                }
              />
            </div>
            <button className="btn-primary" type="submit" disabled={createType.isPending}>
              {createType.isPending ? "Se salvează..." : "Adaugă tip EIP"}
            </button>
            {createType.isSuccess ? (
              <p className="feedback success" role="status">
                Tipul EIP a fost adăugat.
              </p>
            ) : null}
            {createType.isError ? (
              <p className="feedback error" role="alert">
                {mutationErrorMessage(createType.error)}
              </p>
            ) : null}
          </form>

          <div className="card ssm-doc-card">
            <h4 className="card-title">Tipuri existente</h4>
            {(typesQuery.data ?? []).length === 0 ? (
              <p className="field-hint">Nu există tipuri EIP. Adaugă primul tip din formular.</p>
            ) : (
              <div className="ssm-history-list">
                {(typesQuery.data ?? []).map((item) => (
                  <div key={item.id} className="ssm-history-item">
                    <div>
                      <strong>
                        {item.code} — {item.name}
                      </strong>
                      <div className="field-hint">
                        Durată implicită: {item.defaultLifetimeDays ?? "—"} zile
                      </div>
                    </div>
                    <span className={item.active ? "badge-good" : "badge-bad"}>
                      {item.active ? "Activ" : "Inactiv"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "norms" ? (
        <div className="ssm-panel-layout">
          <form className="card form-stack ssm-doc-card" onSubmit={onNormSubmit}>
            <FieldSelect
              id="norm-job"
              label="Post"
              value={normForm.jobPositionId}
              onChange={(jobPositionId) => setNormForm((p) => ({ ...p, jobPositionId }))}
              allowEmpty
              emptyLabel="Selecteaza postul"
              options={mapToOptions(
                jobPositions,
                (job) => job.id,
                (job) => `${job.code} - ${job.name}`
              )}
            />
            <FieldSelect
              id="norm-type"
              label="Tip EIP"
              value={normForm.eipTypeId}
              onChange={(eipTypeId) => setNormForm((p) => ({ ...p, eipTypeId }))}
              allowEmpty
              emptyLabel="Selectează tip"
              options={mapToOptions(
                typesQuery.data ?? [],
                (type) => type.id,
                (type) => `${type.code} - ${type.name}`
              )}
            />
            <div className="field">
              <label htmlFor="norm-qty">Cantitate necesară</label>
              <input
                id="norm-qty"
                type="number"
                value={normForm.requiredQuantity}
                onChange={(e) =>
                  setNormForm((p) => ({ ...p, requiredQuantity: Number(e.target.value || 1) }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="norm-life">Durată de viață (zile)</label>
              <input
                id="norm-life"
                type="number"
                value={normForm.lifetimeDays}
                onChange={(e) =>
                  setNormForm((p) => ({ ...p, lifetimeDays: Number(e.target.value || 365) }))
                }
              />
            </div>
            <div className="field">
              <label htmlFor="norm-rule">Perioadă / regulă de înlocuire</label>
              <input
                id="norm-rule"
                value={normForm.replacementRule ?? ""}
                onChange={(e) => setNormForm((p) => ({ ...p, replacementRule: e.target.value }))}
                placeholder="Ex: La uzură sau la 12 luni"
              />
            </div>
            <button
              className="btn-primary"
              type="submit"
              disabled={upsertNorm.isPending || !normForm.eipTypeId || !normForm.jobPositionId}
            >
              {upsertNorm.isPending ? "Se salvează..." : "Salvează normativ"}
            </button>
            {upsertNorm.isSuccess ? (
              <p className="feedback success" role="status">
                Normativul EIP a fost salvat.
              </p>
            ) : null}
            {upsertNorm.isError ? (
              <p className="feedback error" role="alert">
                {mutationErrorMessage(upsertNorm.error)}
              </p>
            ) : null}
          </form>

          <div className="card ssm-doc-card">
            <h4 className="card-title">Normative salvate</h4>
            {(normsQuery.data?.items ?? []).length === 0 ? (
              <p className="field-hint">Nu există normative EIP pe post.</p>
            ) : (
              <div className="ssm-history-list">
                {(normsQuery.data?.items ?? []).map((item) => (
                  <div key={item.id} className="ssm-history-item">
                    <div>
                      <strong>
                        {item.jobPositionName} · {item.eipTypeName}
                      </strong>
                      <div className="field-hint">
                        Cantitate {item.requiredQuantity} · {item.lifetimeDays} zile
                        {item.replacementRule ? ` · ${item.replacementRule}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "movements" ? (
        <div className="ssm-panel-layout ssm-panel-layout--movement">
          <form className="card form-stack ssm-doc-card" onSubmit={onMovementSubmit}>
            <FieldSelect
              id="mov-kind"
              label="Operațiune"
              value={movementForm.movementType}
              onChange={(movementType) =>
                setMovementForm((p) => ({
                  ...p,
                  movementType: movementType as SsmEipMovementType,
                  signatureData: movementType === "INTAKE" ? "" : p.signatureData
                }))
              }
              options={MOVEMENT_TYPES.map((value) => ({ value, label: MOVEMENT_TYPE_LABELS[value] }))}
            />
            {!isIntake ? (
              <EmployeeSelect
                id="mov-emp"
                value={movementForm.employeeId ?? ""}
                required
                onChange={(employeeId) => setMovementForm((p) => ({ ...p, employeeId }))}
              />
            ) : null}
            <FieldSelect
              id="mov-type"
              label="Tip EIP"
              value={movementForm.eipTypeId}
              onChange={(eipTypeId) => setMovementForm((p) => ({ ...p, eipTypeId }))}
              allowEmpty
              emptyLabel="Selectează tip"
              options={mapToOptions(
                typesQuery.data ?? [],
                (type) => type.id,
                (type) => `${type.code} - ${type.name}`
              )}
            />
            <div className="ssm-panel-fields-row">
              <FieldSelect
                id="mov-worksite"
                label={isIntake ? "Punct de lucru *" : "Punct de lucru"}
                value={movementForm.worksiteId ?? ""}
                onChange={(worksiteId) => setMovementForm((p) => ({ ...p, worksiteId }))}
                allowEmpty
                emptyLabel={isIntake ? "Selectează punct de lucru" : "Din fișa angajatului"}
                options={mapToOptions(
                  worksites,
                  (item) => item.id,
                  (item) => `${item.code} - ${item.name}`
                )}
              />
              <FieldSelect
                id="mov-dept"
                label={isIntake ? "Departament *" : "Departament"}
                value={movementForm.departmentId ?? ""}
                onChange={(departmentId) => setMovementForm((p) => ({ ...p, departmentId }))}
                allowEmpty
                emptyLabel={isIntake ? "Selectează departament" : "Din fișa angajatului"}
                options={mapToOptions(
                  departments,
                  (item) => item.id,
                  (item) => `${item.code} - ${item.name}`
                )}
              />
            </div>
            {isIntake ? (
              <p className="field-hint">Recepția cere cel puțin un punct de lucru sau un departament.</p>
            ) : null}
            <div className="field">
              <label htmlFor="mov-qty">Cantitate</label>
              <input
                id="mov-qty"
                type="number"
                value={movementForm.quantity}
                onChange={(e) =>
                  setMovementForm((p) => ({ ...p, quantity: Number(e.target.value || 1) }))
                }
              />
            </div>
            {!isIntake ? (
              <SignatureCanvas
                label="Semnătură primire EIP"
                value={movementForm.signatureData ?? ""}
                onChange={(dataUrl) => setMovementForm((p) => ({ ...p, signatureData: dataUrl }))}
              />
            ) : null}
            <div className="form-actions">
              <button
                className="btn-primary"
                type="submit"
                disabled={registerMovement.isPending || !canSubmitMovement}
              >
                {registerMovement.isPending ? "Se înregistrează..." : "Înregistrează mișcare"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void downloadWithAuth(ssmApi.getEipRegisterPdfUrl(), "registru-eip.pdf")}
              >
                Descarcă registru PDF
              </button>
            </div>
            {registerMovement.isSuccess ? (
              <p className="feedback success" role="status">
                Mișcarea EIP a fost înregistrată.
              </p>
            ) : null}
            {registerMovement.isError ? (
              <p className="feedback error" role="alert">
                {mutationErrorMessage(registerMovement.error)}
              </p>
            ) : null}
          </form>

          <div className="card ssm-doc-card">
            <h4 className="card-title">Ultimele mișcări</h4>
            <p className="field-hint">{registerQuery.data?.items.length ?? 0} înregistrări în registru</p>
            {(registerQuery.data?.items ?? []).length === 0 ? (
              <p className="field-hint">Nu există mișcări EIP încă.</p>
            ) : (
              <div className="ssm-history-list">
                {(registerQuery.data?.items ?? []).slice(0, 10).map((item) => (
                  <div key={item.id} className="ssm-history-item">
                    <div>
                      <strong>
                        {MOVEMENT_TYPE_LABELS[item.movementType] ?? item.movementType} · {item.eipTypeName}
                      </strong>
                      <div className="field-hint">
                        {item.employeeName ?? "Fără angajat"} ·{" "}
                        {locationLabel(item.worksiteName, item.departmentName)} · cant. {item.quantity}
                      </div>
                    </div>
                    <span className={item.signedAt ? "badge-good" : "badge-bad"}>
                      {item.signedAt ? "Semnat" : "Fără semnătură"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "reports" ? (
        <div className="ssm-panel-layout">
          <div className="card ssm-doc-card">
            <h4 className="card-title">Notificări scadențe</h4>
            <div className="form-actions" style={{ marginBottom: "0.85rem" }}>
              <button
                type="button"
                className="btn-primary"
                disabled={dispatchNotifications.isPending}
                onClick={() => dispatchNotifications.mutate()}
              >
                {dispatchNotifications.isPending ? "Se trimit..." : "Trimite alertele acum"}
              </button>
            </div>
            {dispatchNotifications.isSuccess ? (
              <p className="feedback success" role="status">
                Trimise: {dispatchNotifications.data.sent} (email {dispatchNotifications.data.sentEmail}, in-app{" "}
                {dispatchNotifications.data.sentInApp}, responsabili {dispatchNotifications.data.sentResponsible}) din{" "}
                {dispatchNotifications.data.candidates} scadențe.
              </p>
            ) : null}
            {dispatchNotifications.isError ? (
              <p className="feedback error" role="alert">
                {mutationErrorMessage(dispatchNotifications.error)}
              </p>
            ) : null}
            {(notificationsQuery.data?.reminders ?? []).length === 0 ? (
              <p className="field-hint">Nu există scadențe EIP în fereastra de reminder.</p>
            ) : (
              <div className="ssm-history-list">
                {(notificationsQuery.data?.reminders ?? []).map((item) => (
                  <div key={item.movementId} className="ssm-history-item">
                    <div>
                      <strong>{item.employeeName}</strong>
                      <div className="field-hint">
                        {item.eipTypeName} —{" "}
                        {item.daysUntilDue < 0
                          ? `întârziat ${Math.abs(item.daysUntilDue)} zile`
                          : `${item.daysUntilDue} zile`}
                      </div>
                    </div>
                    <span className={item.daysUntilDue < 0 ? "badge-bad" : "badge-good"}>
                      {item.daysUntilDue < 0 ? "Restanță" : "Reminder"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card ssm-doc-card">
            <h4 className="card-title">Raport stoc (necesar vs. disponibil)</h4>
            {(stockGapQuery.data?.items ?? []).length === 0 ? (
              <p className="field-hint">Nu există date de stoc EIP.</p>
            ) : (
              <div className="ssm-history-list">
                {(stockGapQuery.data?.items ?? []).map((item) => (
                  <div key={`${item.eipTypeId}-${item.scopeKey}`} className="ssm-history-item">
                    <div>
                      <strong>{item.eipTypeName}</strong>
                      <div className="field-hint">
                        {locationLabel(item.worksiteName, item.departmentName)} · necesar {item.required} |
                        distribuit {item.distributedActive} | stoc {item.stockOnHand}
                      </div>
                    </div>
                    <span className={item.shortage > 0 ? "badge-bad" : "badge-good"}>
                      {item.shortage > 0 ? `Lipsă ${item.shortage}` : "OK"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
