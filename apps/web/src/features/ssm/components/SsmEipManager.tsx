import { FormEvent, useEffect, useState } from "react";
import type {
  CreateSsmEipMovementRequest,
  CreateSsmEipNormRequest,
  CreateSsmEipTypeRequest,
  SsmEipMovementType
} from "@repo/shared-types/ssm";
import { useEipNorms, useEipNotifications, useEipRegister, useEipStockGap, useEipTypes, useCreateEipType, useRegisterEipMovement, useUpsertEipNorm } from "../hooks/useSsmEip";
import { SignatureCanvas } from "../../../shared/components/SignatureCanvas";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions, stringOptions } from "../../../shared/components/field-select-options";
import { EmployeeSelect } from "../../master-data/components/EmployeeSelect";
import { useEmployeeOptions, useJobPositionsLookup } from "../../master-data/hooks/useMasterData";

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
  movementType: "DISTRIBUTION",
  quantity: 1,
  notes: "",
  signatureData: ""
};

const MOVEMENT_TYPES: SsmEipMovementType[] = ["DISTRIBUTION", "RETURN", "SCRAP"];

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

export function SsmEipManager() {
  const typesQuery = useEipTypes();
  const jobPositionsQuery = useJobPositionsLookup();
  const employeeOptionsQuery = useEmployeeOptions();
  const jobPositions = jobPositionsQuery.data?.items ?? [];
  const employeeOptions = employeeOptionsQuery.data?.items ?? [];
  const normsQuery = useEipNorms();
  const registerQuery = useEipRegister();
  const notificationsQuery = useEipNotifications();
  const stockGapQuery = useEipStockGap();

  const createType = useCreateEipType();
  const upsertNorm = useUpsertEipNorm();
  const registerMovement = useRegisterEipMovement();

  const [typeForm, setTypeForm] = useState<CreateSsmEipTypeRequest>(EMPTY_TYPE);
  const [normForm, setNormForm] = useState<CreateSsmEipNormRequest>(EMPTY_NORM);
  const [movementForm, setMovementForm] = useState<CreateSsmEipMovementRequest>(EMPTY_MOVEMENT);

  useEffect(() => {
    if (!movementForm.employeeId && employeeOptions[0]?.id) {
      setMovementForm((prev) => ({ ...prev, employeeId: employeeOptions[0]!.id }));
    }
  }, [employeeOptions, movementForm.employeeId]);

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
    registerMovement.mutate(movementForm);
  };

  const loadError =
    typesQuery.error ?? jobPositionsQuery.error ?? normsQuery.error ?? registerQuery.error;
  const loadErrorMessage = loadError instanceof Error ? loadError.message : null;

  return (
    <section className="ssm-documents" aria-labelledby="eip-title">
      <h2 id="eip-title" className="card-title">
        EIP (3.5)
      </h2>
      {loadErrorMessage ? (
        <p className="feedback error" role="alert">
          {loadErrorMessage}
        </p>
      ) : null}

      <div className="ssm-doc-grid">
        <form className="card form-stack ssm-doc-card" onSubmit={onTypeSubmit}>
          <h3 className="card-title">Catalog tipuri EIP</h3>
          <div className="field">
            <label htmlFor="eip-code">Cod</label>
            <input id="eip-code" value={typeForm.code} onChange={(e) => setTypeForm((p) => ({ ...p, code: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="eip-name">Denumire</label>
            <input id="eip-name" value={typeForm.name} onChange={(e) => setTypeForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="eip-life">Durată implicită (zile)</label>
            <input
              id="eip-life"
              type="number"
              value={typeForm.defaultLifetimeDays ?? 365}
              onChange={(e) => setTypeForm((p) => ({ ...p, defaultLifetimeDays: Number(e.target.value || 365) }))}
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
          <p className="field-hint">Tipuri: {(typesQuery.data ?? []).map((t) => t.code).join(", ") || "-"}</p>
        </form>

        <form className="card form-stack ssm-doc-card" onSubmit={onNormSubmit}>
          <h3 className="card-title">Normativ EIP pe post</h3>
          <FieldSelect
            id="norm-job"
            label="Job Position ID"
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
              onChange={(e) => setNormForm((p) => ({ ...p, requiredQuantity: Number(e.target.value || 1) }))}
            />
          </div>
          <div className="field">
            <label htmlFor="norm-life">Durată/inlocuire (zile)</label>
            <input
              id="norm-life"
              type="number"
              value={normForm.lifetimeDays}
              onChange={(e) => setNormForm((p) => ({ ...p, lifetimeDays: Number(e.target.value || 365) }))}
            />
          </div>
          <button className="btn-primary" type="submit" disabled={upsertNorm.isPending || !normForm.eipTypeId || !normForm.jobPositionId}>
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
          <p className="field-hint">Normative: {normsQuery.data?.items.length ?? 0}</p>
        </form>
      </div>

      <div className="ssm-doc-grid second">
        <form className="card form-stack ssm-doc-card" onSubmit={onMovementSubmit}>
          <h3 className="card-title">Distribuții / returnări / casări + semnătură</h3>
          <EmployeeSelect
            id="mov-emp"
            value={movementForm.employeeId}
            required
            onChange={(employeeId) => setMovementForm((p) => ({ ...p, employeeId }))}
          />
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
          <FieldSelect
            id="mov-kind"
            label="Operațiune"
            value={movementForm.movementType}
            onChange={(movementType) =>
              setMovementForm((p) => ({ ...p, movementType: movementType as SsmEipMovementType }))
            }
            options={stringOptions(MOVEMENT_TYPES)}
          />
          <div className="field">
            <label htmlFor="mov-qty">Cantitate</label>
            <input
              id="mov-qty"
              type="number"
              value={movementForm.quantity}
              onChange={(e) => setMovementForm((p) => ({ ...p, quantity: Number(e.target.value || 1) }))}
            />
          </div>
          <SignatureCanvas
            label="Semnătură primire EIP"
            value={movementForm.signatureData ?? ""}
            onChange={(dataUrl) => setMovementForm((p) => ({ ...p, signatureData: dataUrl }))}
          />
          <button className="btn-primary" type="submit" disabled={registerMovement.isPending || !movementForm.eipTypeId || !movementForm.signatureData?.startsWith("data:image")}>
            {registerMovement.isPending ? "Se înregistrează..." : "Înregistrează mișcare"}
          </button>
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
          <p className="field-hint">Registru automat: {registerQuery.data?.items.length ?? 0} înregistrări</p>
        </form>

        <div className="card ssm-doc-card">
          <h3 className="card-title">Notificări scadențe + raport stoc</h3>
          <div className="ssm-history-list">
            {(notificationsQuery.data?.reminders ?? []).slice(0, 5).map((item) => (
              <div key={item.movementId} className="ssm-history-item">
                <div>
                  <strong>{item.employeeName}</strong>
                  <div className="field-hint">
                    {item.eipTypeName} - {item.daysUntilDue < 0 ? `întârziat ${Math.abs(item.daysUntilDue)} zile` : `${item.daysUntilDue} zile`}
                  </div>
                </div>
                <span className={item.daysUntilDue < 0 ? "badge-bad" : "badge-good"}>
                  {item.daysUntilDue < 0 ? "Restanță" : "Reminder"}
                </span>
              </div>
            ))}
          </div>

          <div className="ssm-history-list">
            {(stockGapQuery.data?.items ?? []).slice(0, 6).map((item) => (
              <div key={item.eipTypeId} className="ssm-history-item">
                <div>
                  <strong>{item.eipTypeName}</strong>
                  <div className="field-hint">
                    necesar {item.required} | distribuit {item.distributedActive} | stoc {item.stockOnHand}
                  </div>
                </div>
                <span className={item.shortage > 0 ? "badge-bad" : "badge-good"}>
                  {item.shortage > 0 ? `Lipsă ${item.shortage}` : "OK"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
