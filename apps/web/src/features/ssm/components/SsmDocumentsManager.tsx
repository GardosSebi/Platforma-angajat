import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { stringOptions } from "../../../shared/components/field-select-options";
import { usePagination } from "../../../shared/hooks/use-pagination";
import {
  type CreateSsmDocumentRequest,
  type SsmDocumentStatus,
  type SsmDocumentTypePolicyItem
} from "@repo/shared-types/ssm";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { downloadWithAuth } from "../../../shared/api/http-download";
import {
  useAddSsmDocumentVersion,
  useApproveSsmDocument,
  useArchiveSsmDocument,
  useCreateSsmDocument,
  useRevertSsmDocumentVersion,
  useSsmControlFolders,
  useSsmDocumentHistory,
  useSsmDocuments,
  useSsmDocumentTypePolicies
} from "../hooks/useSsmDocuments";
import { ssmApi } from "../api/ssm.api";

type DocsTab = "library" | "upload" | "templates" | "control" | "policies";

const SSM_DOCUMENT_TYPES: ReadonlyArray<CreateSsmDocumentRequest["type"]> = [
  "IPSSM",
  "RISK_ASSESSMENT",
  "PPP",
  "THEMATIC",
  "DECISION",
  "PSI",
  "REGISTER",
  "EXPOSURE_SHEET",
  "SSM_CONVENTION",
  "DANGEROUS_SUBSTANCES",
  "EMERGENCY_PROCEDURE",
  "OTHER"
];

const SSM_DOCUMENT_TARGET_TYPES: ReadonlyArray<CreateSsmDocumentRequest["targetType"]> = [
  "JOB_POSITION",
  "DEPARTMENT",
  "WORKSITE",
  "ENTITY",
  "ALL"
];

function documentStatusLabel(status: SsmDocumentStatus): string {
  if (status === "APPROVED") return "Aprobat";
  if (status === "ARCHIVED") return "Arhivat";
  return "Neaprobat";
}

function documentStatusChip(status: SsmDocumentStatus): string {
  if (status === "APPROVED") return "good";
  if (status === "ARCHIVED") return "bad";
  return "warn";
}

const TYPE_HINTS: Partial<Record<CreateSsmDocumentRequest["type"], string>> = {
  RISK_ASSESSMENT: "→ Evaluări risc",
  EXPOSURE_SHEET: "→ Evaluări risc",
  PPP: "→ Plan PPP",
  REGISTER: "→ Accidente",
  PSI: "→ PSI",
  EMERGENCY_PROCEDURE: "→ PSI",
  THEMATIC: "→ Instruire"
};

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

const EMPTY_FILTERS = {
  q: "",
  type: "",
  status: "",
  targetType: "",
  entityName: "",
  departmentName: "",
  jobPositionName: "",
  periodFrom: "",
  periodTo: "",
  controlOnly: false
};

function dateInputValue(isoOrEmpty?: string | null): string {
  if (!isoOrEmpty) return "";
  return isoOrEmpty.slice(0, 10);
}

function toIsoDateOrEmpty(value: string): string {
  return value ? new Date(value).toISOString() : "";
}

function formatRoDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ro-RO");
}

function rolesToText(roles: string[]): string {
  return roles.join(", ");
}

function textToRoles(value: string): string[] {
  return value
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
}

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "A apărut o eroare neașteptată.";
}

function DocumentTemplatesPanel({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const templatesQuery = useQuery({
    queryKey: ["ssm", "document-templates"],
    queryFn: () => ssmApi.listDocumentTemplates()
  });
  const seedMutation = useMutation({
    mutationFn: () => ssmApi.seedDocumentTemplates(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ssm", "document-templates"] })
  });
  const uploadFileMutation = useMutation({
    mutationFn: ({ templateId, file }: { templateId: string; file: File }) =>
      ssmApi.uploadDocumentTemplateFile(templateId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ssm", "document-templates"] })
  });
  const createFromTemplateMutation = useMutation({
    mutationFn: (templateId: string) => ssmApi.createDocumentFromTemplate(templateId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ssm", "documents"] }),
        queryClient.invalidateQueries({ queryKey: ["ssm", "document-templates"] })
      ]);
    }
  });

  return (
    <div className="ssm-panel-layout ssm-panel-layout--single" style={{ maxWidth: "48rem" }}>
      <div className="card form-stack ssm-doc-card">
        <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
          <h4 className="card-title" style={{ margin: 0 }}>
            Șabloane
          </h4>
          {canEdit ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? "Se încarcă…" : "Șabloane implicite"}
            </button>
          ) : null}
        </div>
        <p className="field-hint" style={{ marginTop: 0 }}>
          IPSSM, PPP, registru, PSI și altele. Din șablon poți crea rapid un document.
        </p>
        <div className="ssm-history-list">
          {(templatesQuery.data?.items ?? []).map((t) => (
            <div key={t.id} className="ssm-history-item" style={{ alignItems: "flex-start" }}>
              <div>
                <strong>
                  {t.name} · {t.type}
                  {t.isControlFolder ? " · ITM/ISU" : ""}
                </strong>
                <div className="field-hint">
                  {t.title}
                  {t.hasFile ? ` · ${t.fileName ?? "fișier"}` : " · fără fișier"}
                  {t.relatedModuleHint ? ` · ${t.relatedModuleHint}` : ""}
                </div>
                <div className="ssm-inline-actions" style={{ marginTop: "0.35rem" }}>
                  {canEdit ? (
                    <label className="btn-text">
                      Încarcă fișier
                      <input
                        type="file"
                        hidden
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) uploadFileMutation.mutate({ templateId: t.id, file });
                          event.target.value = "";
                        }}
                      />
                    </label>
                  ) : null}
                  {t.hasFile ? (
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() =>
                        void downloadWithAuth(
                          ssmApi.getDocumentTemplateFileUrl(t.id),
                          t.fileName ?? `${t.name}.bin`
                        )
                      }
                    >
                      Descarcă
                    </button>
                  ) : null}
                  {canEdit && t.hasFile ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => createFromTemplateMutation.mutate(t.id)}
                      disabled={createFromTemplateMutation.isPending}
                    >
                      Creează document
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
        {!templatesQuery.isLoading && !(templatesQuery.data?.items ?? []).length ? (
          <p className="field-hint">Niciun șablon. Încarcă setul implicit dacă ai drept de editare.</p>
        ) : null}
        {uploadFileMutation.isError ? (
          <p className="feedback error" role="alert">
            {mutationErrorMessage(uploadFileMutation.error)}
          </p>
        ) : null}
        {createFromTemplateMutation.isSuccess ? (
          <p className="feedback success" role="status">
            Document creat din șablon.
          </p>
        ) : null}
        {createFromTemplateMutation.isError ? (
          <p className="feedback error" role="alert">
            {mutationErrorMessage(createFromTemplateMutation.error)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DocumentTypePoliciesPanel() {
  const queryClient = useQueryClient();
  const policiesQuery = useSsmDocumentTypePolicies();
  const [editingType, setEditingType] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { viewRoles: string; editRoles: string; approveRoles: string; relatedModuleHint: string }>
  >({});

  useEffect(() => {
    const items = policiesQuery.data?.items ?? [];
    const next: typeof drafts = {};
    for (const item of items) {
      next[item.documentType] = {
        viewRoles: rolesToText(item.viewRoles),
        editRoles: rolesToText(item.editRoles),
        approveRoles: rolesToText(item.approveRoles),
        relatedModuleHint: item.relatedModuleHint ?? ""
      };
    }
    setDrafts(next);
  }, [policiesQuery.data?.items]);

  const seedMutation = useMutation({
    mutationFn: () => ssmApi.seedDocumentTypePolicies(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ssm", "documents", "policies"] })
  });

  const saveMutation = useMutation({
    mutationFn: ({
      documentType,
      payload
    }: {
      documentType: string;
      payload: {
        viewRoles: string[];
        editRoles: string[];
        approveRoles: string[];
        relatedModuleHint: string | null;
      };
    }) => ssmApi.upsertDocumentTypePolicy(documentType, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ssm", "documents", "policies"] });
      setEditingType(null);
    }
  });

  const items: SsmDocumentTypePolicyItem[] = policiesQuery.data?.items ?? [];

  return (
    <div className="ssm-panel-layout ssm-panel-layout--single" style={{ maxWidth: "48rem" }}>
      <div className="card form-stack ssm-doc-card">
        <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
          <h4 className="card-title" style={{ margin: 0 }}>
            Acces pe tip document
          </h4>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? "Se încarcă…" : "Politici implicite"}
          </button>
        </div>
        <p className="field-hint" style={{ marginTop: 0 }}>
          Roluri view / edit / approve pe categorie. Click pe tip pentru editare.
        </p>
        <div className="ssm-history-list">
          {items.map((item) => {
            const draft = drafts[item.documentType] ?? {
              viewRoles: rolesToText(item.viewRoles),
              editRoles: rolesToText(item.editRoles),
              approveRoles: rolesToText(item.approveRoles),
              relatedModuleHint: item.relatedModuleHint ?? ""
            };
            const isEditing = editingType === item.documentType;
            return (
              <div key={item.id} className="ssm-history-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
                  <div>
                    <strong>{item.documentType}</strong>
                    <div className="field-hint">
                      View: {item.viewRoles.join(", ") || "—"} · Edit: {item.editRoles.join(", ") || "—"} · Approve:{" "}
                      {item.approveRoles.join(", ") || "—"}
                      {item.relatedModuleHint ? ` · ${item.relatedModuleHint}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => setEditingType(isEditing ? null : item.documentType)}
                  >
                    {isEditing ? "Închide" : "Editează"}
                  </button>
                </div>
                {isEditing ? (
                  <div className="form-stack" style={{ marginTop: "0.5rem" }}>
                    <div className="field">
                      <label htmlFor={`policy-view-${item.documentType}`}>viewRoles</label>
                      <input
                        id={`policy-view-${item.documentType}`}
                        value={draft.viewRoles}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.documentType]: { ...draft, viewRoles: event.target.value }
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`policy-edit-${item.documentType}`}>editRoles</label>
                      <input
                        id={`policy-edit-${item.documentType}`}
                        value={draft.editRoles}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.documentType]: { ...draft, editRoles: event.target.value }
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`policy-approve-${item.documentType}`}>approveRoles</label>
                      <input
                        id={`policy-approve-${item.documentType}`}
                        value={draft.approveRoles}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.documentType]: { ...draft, approveRoles: event.target.value }
                          }))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={saveMutation.isPending}
                      onClick={() =>
                        saveMutation.mutate({
                          documentType: item.documentType,
                          payload: {
                            viewRoles: textToRoles(draft.viewRoles),
                            editRoles: textToRoles(draft.editRoles),
                            approveRoles: textToRoles(draft.approveRoles),
                            relatedModuleHint: draft.relatedModuleHint.trim() || null
                          }
                        })
                      }
                    >
                      Salvează
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {!policiesQuery.isLoading && !items.length ? (
          <p className="field-hint">Nicio politică. Încarcă setul implicit.</p>
        ) : null}
        {seedMutation.isSuccess ? (
          <p className="feedback success" role="status">
            Politici implicite încărcate.
          </p>
        ) : null}
        {seedMutation.isError ? (
          <p className="feedback error" role="alert">
            {mutationErrorMessage(seedMutation.error)}
          </p>
        ) : null}
        {saveMutation.isSuccess ? (
          <p className="feedback success" role="status">
            Politică salvată.
          </p>
        ) : null}
        {saveMutation.isError ? (
          <p className="feedback error" role="alert">
            {mutationErrorMessage(saveMutation.error)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function SsmDocumentsManager() {
  const session = useAuthSession();
  const canUploadDocuments =
    hasPermission(session?.roles, "ssm:documents:edit") && hasPermission(session?.roles, "files:upload");
  const canApproveDocuments = hasPermission(session?.roles, "ssm:documents:approve");
  const canEditDocuments = hasPermission(session?.roles, "ssm:documents:edit");

  const docsPage = usePagination();
  const [tab, setTab] = useState<DocsTab>("library");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
  const [createPayload, setCreatePayload] = useState<CreateSsmDocumentRequest>(EMPTY_DOC);
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionNote, setVersionNote] = useState("");

  const pageTabs = useMemo(() => {
    const tabs: Array<{ id: DocsTab; title: string; caption: string }> = [
      { id: "library", title: "Bibliotecă", caption: "Listă și versiuni" }
    ];
    if (canUploadDocuments) {
      tabs.push({ id: "upload", title: "Upload", caption: "Document nou" });
    }
    tabs.push({ id: "templates", title: "Șabloane", caption: "Modele reutilizabile" });
    tabs.push({ id: "control", title: "Control ITM", caption: "Acces rapid" });
    if (canApproveDocuments) {
      tabs.push({ id: "policies", title: "Acces tipuri", caption: "Roluri pe categorie" });
    }
    return tabs;
  }, [canApproveDocuments, canUploadDocuments]);

  useEffect(() => {
    if (!pageTabs.some((item) => item.id === tab)) {
      setTab("library");
    }
  }, [pageTabs, tab]);

  useEffect(() => {
    docsPage.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset page when filters change
  }, [
    filters.q,
    filters.type,
    filters.status,
    filters.targetType,
    filters.entityName,
    filters.departmentName,
    filters.jobPositionName,
    filters.periodFrom,
    filters.periodTo,
    filters.controlOnly
  ]);

  const docsQuery = useSsmDocuments({ ...filters, ...docsPage.params });
  const docsPaged = paginationFromResult(docsQuery.data, docsPage.page, docsPage.pageSize);
  const historyQuery = useSsmDocumentHistory(selectedDocumentId);
  const controlQuery = useSsmControlFolders();

  const createMutation = useCreateSsmDocument();
  const addVersionMutation = useAddSsmDocumentVersion();
  const revertMutation = useRevertSsmDocumentVersion();
  const archiveMutation = useArchiveSsmDocument();
  const approveMutation = useApproveSsmDocument();

  const selectedDoc = useMemo(
    () => docsPaged.items.find((item) => item.id === selectedDocumentId),
    [docsPaged.items, selectedDocumentId]
  );

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === "controlOnly") return Boolean(value);
    return Boolean(value);
  }).length;

  const activeTabMeta = pageTabs.find((item) => item.id === tab) ?? pageTabs[0];
  const controlFolders = controlQuery.data?.folders ?? [];
  const controlDocsCount = controlFolders.reduce((sum, folder) => sum + folder.count, 0);

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    if (!createFile) return;
    createMutation.mutate(
      { payload: createPayload, file: createFile },
      {
        onSuccess: (result) => {
          setSelectedDocumentId(result.documentId);
          setCreateFile(null);
          setCreatePayload(EMPTY_DOC);
          setTab("library");
        }
      }
    );
  };

  const onUploadVersion = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedDocumentId || !versionFile) return;
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
    <section className="ssm-eip-panel ssm-documents-panel" aria-label="Documente SSM">
      <div className="ssm-training-metrics ssm-overview-metrics" aria-label="Indicatori documente">
        <div>
          <dt>Documente</dt>
          <dd>{docsPaged.total}</dd>
        </div>
        <div>
          <dt>Filtre</dt>
          <dd>{activeFilterCount || "—"}</dd>
        </div>
        <div>
          <dt>ITM/ISU</dt>
          <dd>{controlDocsCount}</dd>
        </div>
        <div>
          <dt>Selectat</dt>
          <dd>{selectedDoc ? `v${selectedDoc.activeVersion.versionNumber}` : "—"}</dd>
        </div>
      </div>

      <div
        className={`ssm-panel-tabs${
          pageTabs.length >= 5
            ? " ssm-panel-tabs--5"
            : pageTabs.length === 3
              ? " ssm-panel-tabs--3"
              : pageTabs.length <= 2
                ? " ssm-panel-tabs--2"
                : ""
        }`}
        role="tablist"
        aria-label="Secțiuni documente SSM"
      >
        {pageTabs.map((item) => (
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

      <header className="ssm-panel-header ssm-overview-toolbar">
        <div>
          <h3 className="card-title">{activeTabMeta.title}</h3>
          <p className="field-hint">{activeTabMeta.caption}</p>
        </div>
        {tab === "library" ? (
          <div className="ssm-inline-actions">
            <button
              type="button"
              className={`btn-secondary${showFilters || activeFilterCount ? " is-active-filter" : ""}`}
              onClick={() => setShowFilters((value) => !value)}
            >
              Filtre{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </button>
            {canUploadDocuments ? (
              <button type="button" className="btn-primary" onClick={() => setTab("upload")}>
                Document nou
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      {tab === "library" ? (
        <>
          {showFilters ? (
            <div className="card form-stack ssm-doc-card ssm-overview-filters">
              <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
                <h4 className="card-title" style={{ margin: 0 }}>
                  Filtre
                </h4>
                <button type="button" className="btn-text" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Resetează
                </button>
              </div>
              <div className="ssm-filter-grid">
                <div className="field">
                  <label htmlFor="doc-filter-q">Căutare</label>
                  <input
                    id="doc-filter-q"
                    placeholder="Titlu / alocare"
                    value={filters.q}
                    onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
                  />
                </div>
                <FieldSelect
                  id="doc-filter-type"
                  label="Tip"
                  value={filters.type}
                  onChange={(type) => setFilters((prev) => ({ ...prev, type }))}
                  allowEmpty
                  emptyLabel="Toate tipurile"
                  options={stringOptions(SSM_DOCUMENT_TYPES)}
                />
                <FieldSelect
                  id="doc-filter-target"
                  label="Alocare"
                  value={filters.targetType}
                  onChange={(targetType) => setFilters((prev) => ({ ...prev, targetType }))}
                  allowEmpty
                  emptyLabel="Toate alocările"
                  options={stringOptions(SSM_DOCUMENT_TARGET_TYPES)}
                />
                <FieldSelect
                  id="doc-filter-status"
                  label="Status"
                  value={filters.status}
                  onChange={(status) => setFilters((prev) => ({ ...prev, status }))}
                  allowEmpty
                  emptyLabel="Toate statusurile"
                  options={[
                    { value: "ACTIVE", label: "Neaprobat" },
                    { value: "APPROVED", label: "Aprobat" },
                    { value: "ARCHIVED", label: "Arhivat" }
                  ]}
                />
                <div className="field">
                  <label htmlFor="doc-filter-entity">Entitate</label>
                  <input
                    id="doc-filter-entity"
                    value={filters.entityName}
                    onChange={(event) => setFilters((prev) => ({ ...prev, entityName: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="doc-filter-department">Departament</label>
                  <input
                    id="doc-filter-department"
                    value={filters.departmentName}
                    onChange={(event) => setFilters((prev) => ({ ...prev, departmentName: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="doc-filter-job">Post</label>
                  <input
                    id="doc-filter-job"
                    value={filters.jobPositionName}
                    onChange={(event) => setFilters((prev) => ({ ...prev, jobPositionName: event.target.value }))}
                  />
                </div>
                <label className="field">
                  <span>Perioadă de la</span>
                  <input
                    type="date"
                    value={dateInputValue(filters.periodFrom)}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, periodFrom: toIsoDateOrEmpty(event.target.value) }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Perioadă până la</span>
                  <input
                    type="date"
                    value={dateInputValue(filters.periodTo)}
                    onChange={(event) =>
                      setFilters((prev) => ({ ...prev, periodTo: toIsoDateOrEmpty(event.target.value) }))
                    }
                  />
                </label>
                <label className="checkbox-row" style={{ alignSelf: "end" }}>
                  <input
                    type="checkbox"
                    checked={filters.controlOnly}
                    onChange={(event) => setFilters((prev) => ({ ...prev, controlOnly: event.target.checked }))}
                  />
                  Numai ITM/ISU
                </label>
              </div>
            </div>
          ) : null}

          <div className="ssm-panel-layout">
            <div className="card form-stack ssm-doc-card">
              <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
                <h4 className="card-title" style={{ margin: 0 }}>
                  Documente
                </h4>
                <span className="ssm-chip">{docsPaged.total}</span>
              </div>
              {docsQuery.isLoading ? <p className="field-hint">Se încarcă…</p> : null}
              <div className="ssm-history-list">
                {docsPaged.items.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    className={`ssm-history-item ssm-overview-select-row${
                      selectedDocumentId === doc.id ? " selected" : ""
                    }`}
                    onClick={() => setSelectedDocumentId(doc.id)}
                  >
                    <div>
                      <strong>{doc.title}</strong>
                      <div className="field-hint">
                        {doc.type} · {doc.targetLabel ?? doc.targetType} · v{doc.activeVersion.versionNumber}
                      </div>
                    </div>
                    <span className={`ssm-chip ${documentStatusChip(doc.status)}`}>
                      {documentStatusLabel(doc.status)}
                    </span>
                  </button>
                ))}
                {!docsQuery.isLoading && !docsPaged.items.length ? (
                  <p className="field-hint">Nu există documente pentru filtrele curente.</p>
                ) : null}
              </div>
              <PaginationBar
                page={docsPaged.page}
                pageSize={docsPaged.pageSize}
                total={docsPaged.total}
                totalPages={docsPaged.totalPages}
                onPageChange={docsPage.setPage}
                onPageSizeChange={docsPage.setPageSize}
                disabled={docsQuery.isFetching}
              />
            </div>

            <div className="card form-stack ssm-doc-card">
              <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
                <h4 className="card-title" style={{ margin: 0 }}>
                  {selectedDoc ? selectedDoc.title : "Detalii document"}
                </h4>
                {selectedDoc ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      void downloadWithAuth(
                        ssmApi.getDocumentFileUrl(selectedDoc.id),
                        selectedDoc.activeVersion.fileName
                      )
                    }
                  >
                    Descarcă activ
                  </button>
                ) : null}
              </div>

              {selectedDoc ? (
                <>
                  <p className="field-hint" style={{ marginTop: 0 }}>
                    {selectedDoc.type}
                    {TYPE_HINTS[selectedDoc.type] ? ` ${TYPE_HINTS[selectedDoc.type]}` : ""} ·{" "}
                    {selectedDoc.targetLabel ?? selectedDoc.targetType} · v
                    {selectedDoc.activeVersion.versionNumber} · {documentStatusLabel(selectedDoc.status)}
                    {selectedDoc.approvedAt
                      ? ` · aprobat ${new Date(selectedDoc.approvedAt).toLocaleDateString("ro-RO")}`
                      : ""}
                    {selectedDoc.isControlFolder ? " · ITM/ISU" : ""}
                  </p>

                  {canUploadDocuments ? (
                    <form onSubmit={onUploadVersion} className="form-stack">
                      <div className="field">
                        <label htmlFor="version-file">Versiune nouă</label>
                        <input
                          id="version-file"
                          type="file"
                          onChange={(event) => setVersionFile(event.target.files?.[0] ?? null)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="version-note">Notă</label>
                        <input
                          id="version-note"
                          value={versionNote}
                          onChange={(event) => setVersionNote(event.target.value)}
                        />
                      </div>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={addVersionMutation.isPending || !versionFile}
                      >
                        {addVersionMutation.isPending ? "Se salvează…" : "Adaugă versiune"}
                      </button>
                      {addVersionMutation.isSuccess ? (
                        <p className="feedback success" role="status">
                          Versiune nouă adăugată.
                        </p>
                      ) : null}
                      {addVersionMutation.isError ? (
                        <p className="feedback error" role="alert">
                          {mutationErrorMessage(addVersionMutation.error)}
                        </p>
                      ) : null}
                    </form>
                  ) : null}

                  {canApproveDocuments ? (
                    <div className="ssm-inline-actions">
                      {selectedDoc?.status !== "APPROVED" && selectedDoc?.status !== "ARCHIVED" ? (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => selectedDocumentId && approveMutation.mutate(selectedDocumentId)}
                          disabled={approveMutation.isPending}
                        >
                          {approveMutation.isPending ? "Se aprobă…" : "Aprobă document"}
                        </button>
                      ) : null}
                      {selectedDoc?.status !== "ARCHIVED" ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => selectedDocumentId && archiveMutation.mutate(selectedDocumentId)}
                          disabled={archiveMutation.isPending}
                        >
                          Arhivează
                        </button>
                      ) : null}
                      {approveMutation.isSuccess ? (
                        <span className="feedback success">Document aprobat.</span>
                      ) : null}
                      {approveMutation.isError ? (
                        <span className="feedback error">{mutationErrorMessage(approveMutation.error)}</span>
                      ) : null}
                      {archiveMutation.isSuccess ? (
                        <span className="feedback success">Document arhivat.</span>
                      ) : null}
                      {archiveMutation.isError ? (
                        <span className="feedback error">{mutationErrorMessage(archiveMutation.error)}</span>
                      ) : null}
                    </div>
                  ) : null}

                  <h5 className="ssm-subtitle">Istoric versiuni</h5>
                  <div className="ssm-history-list">
                    {historyQuery.data?.versions.map((version) => (
                      <div key={version.id} className="ssm-history-item">
                        <div>
                          <strong>
                            v{version.versionNumber} · {version.fileName}
                            {version.isActive ? " · Activ" : ""}
                          </strong>
                          <div className="field-hint">
                            {version.createdByName ?? version.createdBy} · {formatRoDate(version.createdAt)}
                            {version.changeNote ? ` · ${version.changeNote}` : ""}
                          </div>
                        </div>
                        <div className="ssm-inline-actions">
                          <button
                            type="button"
                            className="btn-text"
                            onClick={() =>
                              selectedDocumentId &&
                              void downloadWithAuth(
                                ssmApi.getDocumentVersionFileUrl(selectedDocumentId, version.id),
                                version.fileName
                              )
                            }
                          >
                            Descarcă
                          </button>
                          {canApproveDocuments && !version.isActive ? (
                            <button
                              type="button"
                              className="btn-text"
                              onClick={() =>
                                selectedDocumentId &&
                                revertMutation.mutate({ documentId: selectedDocumentId, versionId: version.id })
                              }
                              disabled={revertMutation.isPending}
                            >
                              Setează activă
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  {revertMutation.isSuccess ? (
                    <p className="feedback success" role="status">
                      Versiunea activă a fost actualizată.
                    </p>
                  ) : null}
                  {revertMutation.isError ? (
                    <p className="feedback error" role="alert">
                      {mutationErrorMessage(revertMutation.error)}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="field-hint">Selectează un document pentru download, versionare și istoric.</p>
              )}
            </div>
          </div>
        </>
      ) : null}

      {tab === "upload" && canUploadDocuments ? (
        <div className="ssm-panel-layout ssm-panel-layout--single" style={{ maxWidth: "36rem" }}>
          <form onSubmit={onCreate} className="card form-stack ssm-doc-card">
            <h4 className="card-title" style={{ margin: 0 }}>
              Upload document nou
            </h4>
            <p className="field-hint" style={{ marginTop: 0 }}>
              Word / PDF / video. Unele tipuri apar și în modulele dedicate (risc, PPP, accidente, PSI).
            </p>
            <div className="field">
              <label htmlFor="doc-title">Titlu</label>
              <input
                id="doc-title"
                value={createPayload.title}
                onChange={(event) => setCreatePayload((prev) => ({ ...prev, title: event.target.value }))}
                required
              />
            </div>
            <FieldSelect
              id="doc-type"
              label="Tip document"
              value={createPayload.type}
              onChange={(type) =>
                setCreatePayload((prev) => ({ ...prev, type: type as CreateSsmDocumentRequest["type"] }))
              }
              options={stringOptions(SSM_DOCUMENT_TYPES)}
            />
            {TYPE_HINTS[createPayload.type] ? (
              <p className="field-hint">{TYPE_HINTS[createPayload.type]}</p>
            ) : null}
            <FieldSelect
              id="doc-target-type"
              label="Alocare"
              value={createPayload.targetType}
              onChange={(targetType) =>
                setCreatePayload((prev) => ({
                  ...prev,
                  targetType: targetType as CreateSsmDocumentRequest["targetType"]
                }))
              }
              options={stringOptions(SSM_DOCUMENT_TARGET_TYPES)}
            />
            <div className="field">
              <label htmlFor="doc-target-label">Etichetă alocare</label>
              <input
                id="doc-target-label"
                value={createPayload.targetLabel ?? ""}
                onChange={(event) => setCreatePayload((prev) => ({ ...prev, targetLabel: event.target.value }))}
                placeholder="ex: Departament Producție"
              />
            </div>
            <div className="ssm-filter-grid">
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
                  onChange={(event) =>
                    setCreatePayload((prev) => ({ ...prev, departmentName: event.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="doc-meta-job">Post</label>
                <input
                  id="doc-meta-job"
                  value={createPayload.jobPositionName ?? ""}
                  onChange={(event) =>
                    setCreatePayload((prev) => ({ ...prev, jobPositionName: event.target.value }))
                  }
                />
              </div>
              <label className="field">
                <span>Perioadă de la</span>
                <input
                  type="date"
                  value={dateInputValue(createPayload.periodStart)}
                  onChange={(event) =>
                    setCreatePayload((prev) => ({ ...prev, periodStart: toIsoDateOrEmpty(event.target.value) }))
                  }
                />
              </label>
              <label className="field">
                <span>Perioadă până la</span>
                <input
                  type="date"
                  value={dateInputValue(createPayload.periodEnd)}
                  onChange={(event) =>
                    setCreatePayload((prev) => ({ ...prev, periodEnd: toIsoDateOrEmpty(event.target.value) }))
                  }
                />
              </label>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(createPayload.isControlFolder)}
                onChange={(event) =>
                  setCreatePayload((prev) => ({ ...prev, isControlFolder: event.target.checked }))
                }
              />
              Include în acces rapid control ITM/ISU
            </label>
            <div className="field">
              <label htmlFor="doc-file">Fișier</label>
              <input
                id="doc-file"
                type="file"
                onChange={(event) => setCreateFile(event.target.files?.[0] ?? null)}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending || !createFile}>
              {createMutation.isPending ? "Se încarcă…" : "Adaugă document"}
            </button>
            {createMutation.isSuccess ? (
              <p className="feedback success" role="status">
                Document adăugat.
              </p>
            ) : null}
            {createMutation.isError ? (
              <p className="feedback error" role="alert">
                {mutationErrorMessage(createMutation.error)}
              </p>
            ) : null}
          </form>
        </div>
      ) : null}

      {tab === "templates" ? <DocumentTemplatesPanel canEdit={canEditDocuments} /> : null}

      {tab === "control" ? (
        <div className="ssm-panel-layout ssm-panel-layout--single" style={{ maxWidth: "36rem" }}>
          <div className="card form-stack ssm-doc-card">
            <div className="ssm-inline-actions" style={{ justifyContent: "space-between" }}>
              <h4 className="card-title" style={{ margin: 0 }}>
                Acces rapid control ITM/ISU
              </h4>
              <span className="ssm-chip">{controlDocsCount}</span>
            </div>
            <p className="field-hint" style={{ marginTop: 0 }}>
              Documente marcate pentru control. Poți filtra biblioteca pe „Numai ITM/ISU”.
            </p>
            <div className="ssm-history-list">
              {controlFolders.map((folder) => (
                <button
                  key={folder.key}
                  type="button"
                  className="ssm-history-item ssm-overview-select-row"
                  onClick={() => {
                    setFilters((prev) => ({ ...prev, controlOnly: true, type: "" }));
                    setShowFilters(true);
                    setTab("library");
                  }}
                >
                  <div>
                    <strong>{folder.label}</strong>
                    <div className="field-hint">{folder.count} documente</div>
                  </div>
                  <span className="ssm-chip">{folder.count}</span>
                </button>
              ))}
              {!controlFolders.length ? (
                <p className="field-hint">Nu sunt încă documente marcate pentru control.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "policies" && canApproveDocuments ? <DocumentTypePoliciesPanel /> : null}
    </section>
  );
}
