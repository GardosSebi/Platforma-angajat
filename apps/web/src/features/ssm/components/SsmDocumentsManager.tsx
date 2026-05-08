import { FormEvent, useMemo, useState } from "react";
import {
  type CreateSsmDocumentRequest,
  type SsmDocumentStatus
} from "@repo/shared-types/ssm";
import {
  useAddSsmDocumentVersion,
  useArchiveSsmDocument,
  useCreateSsmDocument,
  useRevertSsmDocumentVersion,
  useSsmControlFolders,
  useSsmDocumentHistory,
  useSsmDocuments
} from "../hooks/useSsmDocuments";

const SSM_DOCUMENT_TYPES: ReadonlyArray<CreateSsmDocumentRequest["type"]> = [
  "IPSSM",
  "RISK_ASSESSMENT",
  "PPP",
  "THEMATIC",
  "DECISION",
  "PSI",
  "REGISTER",
  "OTHER"
];

const SSM_DOCUMENT_TARGET_TYPES: ReadonlyArray<CreateSsmDocumentRequest["targetType"]> = [
  "JOB_POSITION",
  "DEPARTMENT",
  "WORKSITE",
  "ENTITY",
  "ALL"
];

const STATUS_OPTIONS: Array<SsmDocumentStatus | ""> = ["", "ACTIVE", "ARCHIVED"];

const EMPTY_DOC: CreateSsmDocumentRequest = {
  title: "",
  type: "IPSSM",
  entityName: "",
  departmentName: "",
  jobPositionName: "",
  periodStart: "",
  periodEnd: "",
  targetType: "ALL",
  targetRefId: "",
  targetLabel: "",
  isControlFolder: false,
  changeNote: ""
};

export function SsmDocumentsManager() {
  const [filters, setFilters] = useState({
    q: "",
    type: "",
    status: "",
    targetType: "",
    controlOnly: false
  });
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
  const [createPayload, setCreatePayload] = useState<CreateSsmDocumentRequest>(EMPTY_DOC);
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionNote, setVersionNote] = useState("");

  const docsQuery = useSsmDocuments(filters);
  const historyQuery = useSsmDocumentHistory(selectedDocumentId);
  const controlQuery = useSsmControlFolders();

  const createMutation = useCreateSsmDocument();
  const addVersionMutation = useAddSsmDocumentVersion();
  const revertMutation = useRevertSsmDocumentVersion();
  const archiveMutation = useArchiveSsmDocument();

  const selectedDoc = useMemo(
    () => docsQuery.data?.items.find((item) => item.id === selectedDocumentId),
    [docsQuery.data?.items, selectedDocumentId]
  );

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    if (!createFile) {
      return;
    }
    createMutation.mutate(
      { payload: createPayload, file: createFile },
      {
        onSuccess: (result) => {
          setSelectedDocumentId(result.documentId);
          setCreateFile(null);
          setCreatePayload(EMPTY_DOC);
        }
      }
    );
  };

  const onUploadVersion = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedDocumentId || !versionFile) {
      return;
    }
    addVersionMutation.mutate(
      {
        documentId: selectedDocumentId,
        file: versionFile,
        changeNote: versionNote
      },
      {
        onSuccess: () => {
          setVersionFile(null);
          setVersionNote("");
        }
      }
    );
  };

  return (
    <section className="ssm-documents" aria-labelledby="ssm-documents-title">
      <h2 id="ssm-documents-title" className="card-title">
        Documente SSM (3.2)
      </h2>

      <div className="ssm-doc-grid">
        <form onSubmit={onCreate} className="card form-stack ssm-doc-card">
          <h3 className="card-title">Upload document nou</h3>
          <div className="field">
            <label htmlFor="doc-title">Titlu document</label>
            <input
              id="doc-title"
              value={createPayload.title}
              onChange={(event) => setCreatePayload((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="doc-type">Tip document</label>
            <select
              id="doc-type"
              value={createPayload.type}
              onChange={(event) =>
                setCreatePayload((prev) => ({ ...prev, type: event.target.value as CreateSsmDocumentRequest["type"] }))
              }
            >
              {SSM_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="doc-target-type">Alocare</label>
            <select
              id="doc-target-type"
              value={createPayload.targetType}
              onChange={(event) =>
                setCreatePayload((prev) => ({
                  ...prev,
                  targetType: event.target.value as CreateSsmDocumentRequest["targetType"]
                }))
              }
            >
              {SSM_DOCUMENT_TARGET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="doc-target-label">Etichetă alocare</label>
            <input
              id="doc-target-label"
              value={createPayload.targetLabel ?? ""}
              onChange={(event) => setCreatePayload((prev) => ({ ...prev, targetLabel: event.target.value }))}
              placeholder="ex: Departament Producție"
            />
          </div>
          <div className="field">
            <label htmlFor="doc-meta-entity">Entitate</label>
            <input
              id="doc-meta-entity"
              value={createPayload.entityName ?? ""}
              onChange={(event) => setCreatePayload((prev) => ({ ...prev, entityName: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="doc-meta-department">Departament</label>
            <input
              id="doc-meta-department"
              value={createPayload.departmentName ?? ""}
              onChange={(event) => setCreatePayload((prev) => ({ ...prev, departmentName: event.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="doc-meta-job">Post</label>
            <input
              id="doc-meta-job"
              value={createPayload.jobPositionName ?? ""}
              onChange={(event) => setCreatePayload((prev) => ({ ...prev, jobPositionName: event.target.value }))}
            />
          </div>
          <div className="field inline-check">
            <input
              id="doc-control-folder"
              type="checkbox"
              checked={Boolean(createPayload.isControlFolder)}
              onChange={(event) => setCreatePayload((prev) => ({ ...prev, isControlFolder: event.target.checked }))}
            />
            <label htmlFor="doc-control-folder">Include în acces rapid control ITM/ISU</label>
          </div>
          <div className="field">
            <label htmlFor="doc-file">Fișier (Word/PDF/video)</label>
            <input id="doc-file" type="file" onChange={(event) => setCreateFile(event.target.files?.[0] ?? null)} required />
          </div>
          <button type="submit" className="btn-primary" disabled={createMutation.isPending || !createFile}>
            {createMutation.isPending ? "Se încarcă..." : "Adaugă document"}
          </button>
        </form>

        <div className="card ssm-doc-card ssm-doc-list">
          <h3 className="card-title">Căutare și filtrare</h3>
          <div className="ssm-filters">
            <input
              placeholder="Caută titlu/alocare"
              value={filters.q}
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
            />
            <select value={filters.type} onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}>
              <option value="">Toate tipurile</option>
              {SSM_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              value={filters.targetType}
              onChange={(event) => setFilters((prev) => ({ ...prev, targetType: event.target.value }))}
            >
              <option value="">Toate alocările</option>
              {SSM_DOCUMENT_TARGET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">Toate statusurile</option>
              {STATUS_OPTIONS.filter(Boolean).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={filters.controlOnly}
                onChange={(event) => setFilters((prev) => ({ ...prev, controlOnly: event.target.checked }))}
              />
              Numai ITM/ISU
            </label>
          </div>

          <div className="ssm-documents-table">
            {docsQuery.data?.items.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className={`ssm-doc-row ${selectedDocumentId === doc.id ? "selected" : ""}`}
                onClick={() => setSelectedDocumentId(doc.id)}
              >
                <strong>{doc.title}</strong>
                <span>{doc.type}</span>
                <span>{doc.targetLabel ?? doc.targetType}</span>
                <span>v{doc.activeVersion.versionNumber}</span>
                <span>{doc.status}</span>
              </button>
            ))}
            {!docsQuery.data?.items.length ? <p className="field-hint">Nu există documente pentru filtrele curente.</p> : null}
          </div>
        </div>
      </div>

      <div className="ssm-doc-grid second">
        <div className="card ssm-doc-card">
          <h3 className="card-title">Versionare / istoric</h3>
          {selectedDoc ? (
            <>
              <p className="field-hint">
                Activ: <strong>{selectedDoc.title}</strong> (v{selectedDoc.activeVersion.versionNumber})
              </p>
              <form onSubmit={onUploadVersion} className="form-stack">
                <div className="field">
                  <label htmlFor="version-file">Upload versiune nouă</label>
                  <input
                    id="version-file"
                    type="file"
                    onChange={(event) => setVersionFile(event.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="version-note">Notă versiune</label>
                  <input id="version-note" value={versionNote} onChange={(event) => setVersionNote(event.target.value)} />
                </div>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={addVersionMutation.isPending || !versionFile || !selectedDocumentId}
                >
                  {addVersionMutation.isPending ? "Se salvează..." : "Adaugă versiune"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => selectedDocumentId && archiveMutation.mutate(selectedDocumentId)}
                  disabled={archiveMutation.isPending || !selectedDocumentId}
                >
                  Arhivează document
                </button>
              </form>

              <div className="ssm-history-list">
                {historyQuery.data?.versions.map((version) => (
                  <div key={version.id} className="ssm-history-item">
                    <div>
                      <strong>v{version.versionNumber}</strong> {version.fileName}
                    </div>
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => selectedDocumentId && revertMutation.mutate({ documentId: selectedDocumentId, versionId: version.id })}
                      disabled={revertMutation.isPending}
                    >
                      Setează activă
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="field-hint">Selectează un document din listă pentru istoric și acțiuni de versionare.</p>
          )}
        </div>

        <div className="card ssm-doc-card">
          <h3 className="card-title">Acces rapid control ITM/ISU</h3>
          {controlQuery.data?.folders.map((folder) => (
            <div key={folder.key} className="ssm-folder">
              <strong>{folder.label}</strong>
              <span>{folder.count} documente</span>
            </div>
          ))}
          {!controlQuery.data?.folders.length ? <p className="field-hint">Nu sunt încă documente marcate pentru control.</p> : null}
        </div>
      </div>
    </section>
  );
}
