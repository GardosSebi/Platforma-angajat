import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { isWorksiteScopedViewer } from "../../../shared/auth/worksite-scope";
import type {
  CommunicationAnnouncementItem,
  CommunicationAudienceType,
  CommunicationCategory,
  CommunicationContentType,
  CreateCommunicationAnnouncementRequest,
  CreateCommunicationTemplateRequest
} from "@repo/shared-types/communications";
import { COMMUNICATION_CATEGORIES, COMMUNICATION_CATEGORY_LABELS } from "@repo/shared-types/communications";
import {
  useDepartmentsLookup,
  useEmployeeOptions,
  useJobPositionsLookup,
  useWorksitesLookup
} from "../../master-data/hooks/useMasterData";
import { PaginationBar, paginationFromResult } from "../../../shared/components/PaginationBar";
import { FieldSelect } from "../../../shared/components/FieldSelect";
import { mapToOptions, stringOptions } from "../../../shared/components/field-select-options";
import { usePagination } from "../../../shared/hooks/use-pagination";
import {
  useAnnouncements,
  useChatbotDashboard,
  useCommunicationReminders,
  useCommunicationTemplates,
  useCreateAnnouncement,
  useCreateCommunicationTemplate,
  useDispatchCommunicationReminders,
  useDuplicateAnnouncement,
  usePublishAnnouncement,
  useRetractAnnouncement
} from "../hooks/useChatbot";

const CONTENT_TYPES: CommunicationContentType[] = ["TEXT", "RICH_TEXT", "LINK", "DOCUMENT", "SURVEY"];
const AUDIENCE_TYPES: CommunicationAudienceType[] = [
  "ALL",
  "WORKSITE",
  "DEPARTMENT",
  "JOB_POSITION",
  "EMPLOYEE",
  "CUSTOM"
];

const CONTENT_TYPE_LABELS: Record<CommunicationContentType, string> = {
  TEXT: "Text",
  RICH_TEXT: "Text formatat",
  LINK: "Link",
  DOCUMENT: "Document",
  SURVEY: "Sondaj"
};

const STATUS_LABELS: Record<CommunicationAnnouncementItem["status"], string> = {
  DRAFT: "Ciornă",
  SCHEDULED: "Programat",
  PUBLISHED: "Publicat",
  RETRACTED: "Retras",
  ARCHIVED: "Arhivat"
};

const AUDIENCE_LABELS: Record<CommunicationAudienceType, string> = {
  ALL: "Toți angajații",
  WORKSITE: "Punct de lucru",
  DEPARTMENT: "Departament",
  JOB_POSITION: "Post",
  EMPLOYEE_GROUP: "Grup angajați",
  EMPLOYEE: "Angajat",
  CUSTOM: "Listă personalizată"
};

type AnnouncementForm = CreateCommunicationAnnouncementRequest & {
  targetEmployeeIdsCsv: string;
};

type FeedbackState = {
  type: "success" | "error";
  message: string;
};

const EMPTY_ANNOUNCEMENT: AnnouncementForm = {
  title: "Anunț intern",
  body: "Mesaj pentru angajați...",
  category: "GENERAL",
  contentType: "TEXT",
  audienceType: "ALL",
  status: "DRAFT",
  publishAt: "",
  expiresAt: "",
  reminderAt: "",
  contentUrl: "",
  targetEmployeeIdsCsv: ""
};

const EMPTY_TEMPLATE: CreateCommunicationTemplateRequest = {
  name: "Memento document",
  title: "Document nou disponibil",
  body: "Te rugăm să verifici documentul publicat în platformă.",
  contentType: "TEXT",
  audienceType: "ALL",
  contentUrl: ""
};

function mutationErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "A apărut o eroare neașteptată.";
  }
  const translations: Record<string, string> = {
    "Invalid date": "Dată invalidă",
    "Employee not found for tenant.": "Angajatul nu a fost găsit pentru tenantul curent.",
    "Template not found for tenant.": "Șablonul nu a fost găsit pentru tenantul curent.",
    "Announcement not found for tenant.": "Anunțul nu a fost găsit pentru tenantul curent.",
    "Custom audience requires targetEmployeeIds.": "Lista personalizată necesită cel puțin un angajat.",
    "One or more target employees were not found for tenant.": "Unul sau mai mulți angajați selectați nu au fost găsiți pentru tenantul curent.",
    "Not signed in or session expired. Sign in with tenant e01 and try again.": "Sesiunea a expirat. Autentifică-te din nou și încearcă iar.",
    "You do not have permission for this action.": "Nu ai permisiune pentru această acțiune.",
    "API route not found.": "Ruta API nu a fost găsită.",
    "Request failed": "Cererea a eșuat",
    "Cannot reach the API": "API-ul nu poate fi contactat"
  };
  const exact = translations[error.message];
  if (exact) return exact;
  const partial = Object.entries(translations).find(([key]) => error.message.includes(key));
  return partial ? error.message.replace(partial[0], partial[1]) : error.message;
}

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function statusChip(status: CommunicationAnnouncementItem["status"]): string {
  if (status === "PUBLISHED") return "good";
  if (status === "SCHEDULED" || status === "DRAFT") return "warn";
  return "bad";
}

export function ChatbotPage() {
  const session = useAuthSession();
  const roles = session?.roles;
  const canViewDashboard = hasPermission(roles, "communications:dashboard:view");
  const canEditAnnouncements = hasPermission(roles, "communications:announcements:edit");
  const canEditTemplates = hasPermission(roles, "communications:templates:edit");
  const worksiteRestricted = isWorksiteScopedViewer(session?.roles);
  const audienceTypesForForm = useMemo(
    () => (worksiteRestricted ? AUDIENCE_TYPES.filter((t) => t !== "ALL") : AUDIENCE_TYPES),
    [worksiteRestricted]
  );

  useEffect(() => {
    if (!worksiteRestricted) return;
    setAnnouncementForm((prev) =>
      prev.audienceType === "ALL" ? { ...prev, audienceType: "WORKSITE" } : prev
    );
    setTemplateForm((prev) => (prev.audienceType === "ALL" ? { ...prev, audienceType: "WORKSITE" } : prev));
  }, [worksiteRestricted]);

  const announcementsPage = usePagination();
  const dashboardQuery = useChatbotDashboard(canViewDashboard);
  const announcementsQuery = useAnnouncements(announcementsPage.params);
  const templatesQuery = useCommunicationTemplates();
  const remindersQuery = useCommunicationReminders();
  const worksitesLookup = useWorksitesLookup();
  const departmentsLookup = useDepartmentsLookup();
  const jobPositionsLookup = useJobPositionsLookup();
  const employeesOptions = useEmployeeOptions();

  const createAnnouncement = useCreateAnnouncement();
  const publishAnnouncement = usePublishAnnouncement();
  const retractAnnouncement = useRetractAnnouncement();
  const duplicateAnnouncement = useDuplicateAnnouncement();
  const dispatchReminders = useDispatchCommunicationReminders();
  const createTemplate = useCreateCommunicationTemplate();

  const [announcementForm, setAnnouncementForm] = useState<AnnouncementForm>(EMPTY_ANNOUNCEMENT);
  const [templateForm, setTemplateForm] = useState<CreateCommunicationTemplateRequest>(EMPTY_TEMPLATE);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [announcementFeedback, setAnnouncementFeedback] = useState<FeedbackState | null>(null);
  const [templateFeedback, setTemplateFeedback] = useState<FeedbackState | null>(null);
  const [actionFeedback, setActionFeedback] = useState<FeedbackState | null>(null);
  const [openedAnnouncementId, setOpenedAnnouncementId] = useState("");

  const latest = dashboardQuery.data?.latestAnnouncements ?? [];
  const announcementsPaged = paginationFromResult(
    announcementsQuery.data,
    announcementsPage.page,
    announcementsPage.pageSize
  );
  const announcements = announcementsPaged.items;

  const announcementById = useMemo(() => {
    const map = new Map<string, CommunicationAnnouncementItem>();
    for (const item of [...announcements, ...latest]) {
      map.set(item.id, item);
    }
    return map;
  }, [announcements, latest]);

  const openedAnnouncement = openedAnnouncementId ? announcementById.get(openedAnnouncementId) : undefined;
  const reminders = remindersQuery.data ?? [];
  const kpi = dashboardQuery.data?.kpi;

  const audienceOptions = useMemo(() => {
    if (announcementForm.audienceType === "WORKSITE") {
      return (worksitesLookup.data?.items ?? []).map((item) => ({ id: item.id, label: `${item.code} - ${item.name}` }));
    }
    if (announcementForm.audienceType === "DEPARTMENT") {
      return (departmentsLookup.data?.items ?? []).map((item) => ({ id: item.id, label: `${item.code} - ${item.name}` }));
    }
    if (announcementForm.audienceType === "JOB_POSITION") {
      return (jobPositionsLookup.data?.items ?? []).map((item) => ({ id: item.id, label: `${item.code} - ${item.name}` }));
    }
    if (announcementForm.audienceType === "EMPLOYEE") {
      return (employeesOptions.data?.items ?? []).map((item) => ({ id: item.id, label: `${item.fullName} - ${item.email}` }));
    }
    return [];
  }, [
    announcementForm.audienceType,
    departmentsLookup.data?.items,
    employeesOptions.data?.items,
    jobPositionsLookup.data?.items,
    worksitesLookup.data?.items
  ]);

  const selectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templatesQuery.data?.items.find((item) => item.id === templateId);
    if (!template) return;
    setAnnouncementForm((prev) => ({
      ...prev,
      templateId: template.id,
      title: template.title,
      body: template.body,
      contentType: template.contentType,
      contentUrl: template.contentUrl ?? "",
      audienceType: template.audienceType,
      audienceRefId: template.audienceRefId ?? "",
      audienceLabel: template.audienceLabel ?? ""
    }));
  };

  const onAudienceRefChange = (value: string) => {
    const option = audienceOptions.find((item) => item.id === value);
    setAnnouncementForm((prev) => ({ ...prev, audienceRefId: value, audienceLabel: option?.label ?? "" }));
  };

  const onAnnouncementSubmit = (event: FormEvent) => {
    event.preventDefault();
    setAnnouncementFeedback(null);
    const { targetEmployeeIdsCsv, ...form } = announcementForm;
    const payload: CreateCommunicationAnnouncementRequest = {
      ...form,
      contentUrl: announcementForm.contentUrl || undefined,
      audienceRefId: announcementForm.audienceRefId || undefined,
      audienceLabel: announcementForm.audienceLabel || undefined,
      targetEmployeeIds:
        announcementForm.audienceType === "CUSTOM"
          ? targetEmployeeIdsCsv.split(",").map((item) => item.trim()).filter(Boolean)
          : undefined,
      publishAt: announcementForm.publishAt || undefined,
      expiresAt: announcementForm.expiresAt || undefined,
      reminderAt: announcementForm.reminderAt || undefined,
      templateId: announcementForm.templateId || undefined
    };
    createAnnouncement.mutate(payload, {
      onSuccess: () => {
        setAnnouncementForm(EMPTY_ANNOUNCEMENT);
        setSelectedTemplateId("");
        setAnnouncementFeedback({ type: "success", message: "Anunțul a fost salvat cu succes." });
      },
      onError: (error) => {
        setAnnouncementFeedback({ type: "error", message: mutationErrorMessage(error) });
      }
    });
  };

  const onTemplateSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTemplateFeedback(null);
    createTemplate.mutate({
      ...templateForm,
      contentUrl: templateForm.contentUrl || undefined,
      audienceRefId: templateForm.audienceRefId || undefined,
      audienceLabel: templateForm.audienceLabel || undefined
    }, {
      onSuccess: () => {
        setTemplateForm(EMPTY_TEMPLATE);
        setTemplateFeedback({ type: "success", message: "Șablonul a fost salvat cu succes." });
      },
      onError: (error) => {
        setTemplateFeedback({ type: "error", message: mutationErrorMessage(error) });
      }
    });
  };

  const runAnnouncementAction = (action: "publish" | "retract" | "duplicate", announcementId: string) => {
    setActionFeedback(null);
    const labels = {
      publish: "Anunțul a fost publicat.",
      retract: "Anunțul a fost retras.",
      duplicate: "Anunțul a fost duplicat."
    };
    const options = {
      onSuccess: () => setActionFeedback({ type: "success", message: labels[action] }),
      onError: (error: unknown) => setActionFeedback({ type: "error", message: mutationErrorMessage(error) })
    };
    if (action === "publish") publishAnnouncement.mutate(announcementId, options);
    if (action === "retract") retractAnnouncement.mutate(announcementId, options);
    if (action === "duplicate") duplicateAnnouncement.mutate(announcementId, options);
  };

  return (
    <>
      <h1 className="page-title">Comunicări / Chatbot angajați</h1>
      <p className="page-lead">
        Partea L: panou KPI, anunțuri granulare, statistici de citire, mementouri și funcții avansate etapizate.
      </p>
      {worksiteRestricted ? (
        <div className="callout-warn" role="status">
          Vizibilitatea și comunicarea sunt limitate la angajații din același punct de lucru ca profilul tău (responsabil
          SSM, manager sau angajat).
        </div>
      ) : null}
      {!canViewDashboard ? (
        <div className="callout-warn" role="status">
          Panoul KPI este disponibil doar conturilor cu drept de administrare comunicări. Poți consulta lista de anunțuri
          mai jos.
        </div>
      ) : null}
      {!canEditAnnouncements ? (
        <div className="callout-warn" role="status">
          Contul tău are acces doar în citire la anunțuri. Crearea și publicarea necesită rol de administrator sau responsabil
          SSM.
        </div>
      ) : null}

      <section className="ssm-documents" aria-labelledby="communications-title">
        <div className="ssm-module-hero">
          <div className="card ssm-hero-card">
            <p className="ssm-card-eyebrow">Partea L · 4.1 + 4.2</p>
            <h2 id="communications-title" className="card-title">
              Centru comunicări
            </h2>
            <p className="ssm-hero-lead">
              Publică anunțuri către audiențe precise, urmărește citirea și programează mementouri pentru mesajele critice.
            </p>
            <div className="ssm-badge-row">
              <span className="ssm-chip">Panou KPI</span>
              <span className="ssm-chip">Anunțuri și destinatari</span>
              <span className="ssm-chip">Șabloane</span>
            </div>
          </div>

          <div className="ssm-summary-strip">
            <div className="ssm-stat-card">
              <span>Digitalizare</span>
              <strong>{kpi ? `${kpi.digitalizationRate}%` : "-"}</strong>
            </div>
            <div className="ssm-stat-card">
              <span>Activi</span>
              <strong>{kpi?.activeEmployees ?? "-"}</strong>
            </div>
            <div className="ssm-stat-card">
              <span>Citire</span>
              <strong>{kpi ? `${kpi.readRate}%` : "-"}</strong>
            </div>
          </div>
        </div>

        <div className="ssm-doc-grid">
          <div className="card ssm-doc-card">
            <div className="ssm-card-header">
              <div>
                <h3 className="card-title">Ultimele anunțuri</h3>
                <p className="field-hint">Apasă pe un anunț pentru a-l deschide. KPI rapid pentru publicări recente și citire.</p>
              </div>
              <span className="ssm-chip">{kpi?.activeAnnouncements ?? 0} publicate</span>
            </div>
            <div className="ssm-doc-items">
              {dashboardQuery.isLoading ? <p className="field-hint">Se încarcă dashboard-ul...</p> : null}
              {latest.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ssm-doc-item ${openedAnnouncementId === item.id ? "selected" : ""}`}
                  onClick={() => setOpenedAnnouncementId(item.id)}
                >
                  <strong>{item.title}</strong>
                  <span>
                    {formatDate(item.publishAt ?? item.createdAt)} · {AUDIENCE_LABELS[item.audienceType]} ·{" "}
                    {STATUS_LABELS[item.status]} · citire {item.stats.readRate}%
                  </span>
                  <div className="ssm-progress" aria-label={`Citire ${item.stats.readRate}%`}>
                    <span style={{ width: `${Math.max(0, Math.min(item.stats.readRate, 100))}%` }} />
                  </div>
                </button>
              ))}
              {!dashboardQuery.isLoading && latest.length === 0 ? <p className="field-hint">Nu există anunțuri încă.</p> : null}
            </div>
          </div>

          {canEditAnnouncements ? (
          <form className="card form-stack ssm-doc-card" onSubmit={onAnnouncementSubmit}>
            <div className="ssm-card-header">
              <div>
                <h3 className="card-title">Adaugă mesaj / anunț</h3>
                <p className="field-hint">Conținut, destinatari granulari, programare și memento.</p>
              </div>
            </div>
            <div className="ssm-form-grid">
              <FieldSelect
                id="template-select"
                label="Șablon"
                className="wide"
                value={selectedTemplateId}
                onChange={selectTemplate}
                allowEmpty
                emptyLabel="Fără șablon"
                options={mapToOptions(
                  templatesQuery.data?.items ?? [],
                  (template) => template.id,
                  (template) => template.name
                )}
              />
              <FieldSelect
                id="announcement-category"
                label="Categorie mesaj"
                value={announcementForm.category ?? "GENERAL"}
                onChange={(category) =>
                  setAnnouncementForm((prev) => ({
                    ...prev,
                    category: category as CommunicationCategory
                  }))
                }
                options={stringOptions(COMMUNICATION_CATEGORIES, (cat) => COMMUNICATION_CATEGORY_LABELS[cat])}
              />
              <div className="field wide">
                <label htmlFor="announcement-title">Titlu</label>
                <input
                  id="announcement-title"
                  value={announcementForm.title}
                  onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
              </div>
              <div className="field wide">
                <label htmlFor="announcement-body">Mesaj</label>
                <textarea
                  id="announcement-body"
                  value={announcementForm.body}
                  onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, body: event.target.value }))}
                  required
                />
              </div>
              <FieldSelect
                id="content-type"
                label="Tip conținut"
                value={announcementForm.contentType}
                onChange={(contentType) =>
                  setAnnouncementForm((prev) => ({ ...prev, contentType: contentType as CommunicationContentType }))
                }
                options={stringOptions(CONTENT_TYPES, (type) => CONTENT_TYPE_LABELS[type])}
              />
              <div className="field">
                <label htmlFor="content-url">Link / document</label>
                <input
                  id="content-url"
                  value={announcementForm.contentUrl ?? ""}
                  onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, contentUrl: event.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <FieldSelect
                id="audience-type"
                label="Destinatari"
                value={announcementForm.audienceType}
                onChange={(audienceType) =>
                  setAnnouncementForm((prev) => ({
                    ...prev,
                    audienceType: audienceType as CommunicationAudienceType,
                    audienceRefId: "",
                    audienceLabel: ""
                  }))
                }
                options={stringOptions(audienceTypesForForm, (type) => AUDIENCE_LABELS[type])}
              />
              {audienceOptions.length > 0 ? (
                <FieldSelect
                  id="audience-ref"
                  label="Segment"
                  value={announcementForm.audienceRefId ?? ""}
                  onChange={onAudienceRefChange}
                  allowEmpty
                  emptyLabel="Selectează segmentul"
                  options={mapToOptions(
                    audienceOptions,
                    (option) => option.id,
                    (option) => option.label
                  )}
                />
              ) : null}
              {announcementForm.audienceType === "CUSTOM" ? (
                <div className="field wide">
                  <label htmlFor="custom-employees">Listă personalizată de angajați</label>
                  <textarea
                    id="custom-employees"
                    value={announcementForm.targetEmployeeIdsCsv}
                    onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, targetEmployeeIdsCsv: event.target.value }))}
                    placeholder="idAngajat1, idAngajat2"
                  />
                  <p className="field-hint">Angajați disponibili: {(employeesOptions.data?.items ?? []).slice(0, 4).map((item) => item.fullName).join(", ")}</p>
                </div>
              ) : null}
              <FieldSelect
                id="announcement-status"
                label="Stare inițială"
                value={announcementForm.status}
                onChange={(status) =>
                  setAnnouncementForm((prev) => ({ ...prev, status: status as "DRAFT" | "PUBLISHED" }))
                }
                options={[
                  { value: "DRAFT", label: "Ciornă" },
                  { value: "PUBLISHED", label: "Publicat / programat" }
                ]}
              />
              <div className="field">
                <label htmlFor="publish-at">Programare</label>
                <input
                  id="publish-at"
                  type="datetime-local"
                  value={announcementForm.publishAt ?? ""}
                  onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, publishAt: event.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="expires-at">Expiră la</label>
                <input
                  id="expires-at"
                  type="datetime-local"
                  value={announcementForm.expiresAt ?? ""}
                  onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="reminder-at">Memento</label>
                <input
                  id="reminder-at"
                  type="datetime-local"
                  value={announcementForm.reminderAt ?? ""}
                  onChange={(event) => setAnnouncementForm((prev) => ({ ...prev, reminderAt: event.target.value }))}
                />
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={createAnnouncement.isPending}>
              {createAnnouncement.isPending ? "Se salvează..." : "Salvează anunț"}
            </button>
            {announcementFeedback ? (
              <div className={`feedback ${announcementFeedback.type}`} role={announcementFeedback.type === "error" ? "alert" : "status"}>
                {announcementFeedback.message}
              </div>
            ) : null}
          </form>
          ) : null}
        </div>

        <div className="ssm-doc-grid second">
          <div className="card ssm-doc-card">
            <div className="ssm-card-header">
              <div>
                <h3 className="card-title">Anunțuri și statistici citire</h3>
                <p className="field-hint">Retragere, duplicare și publicare etapizată.</p>
              </div>
              <span className="ssm-chip">{announcementsPaged.total} total</span>
            </div>
            <div className="ssm-doc-items">
              {actionFeedback ? (
                <div className={`feedback ${actionFeedback.type}`} role={actionFeedback.type === "error" ? "alert" : "status"}>
                  {actionFeedback.message}
                </div>
              ) : null}
              {announcements.map((item) => (
                <article key={item.id} className={`ssm-doc-item ${openedAnnouncementId === item.id ? "selected" : ""}`}>
                  <strong>{item.title}</strong>
                  <span>
                    {formatDate(item.publishAt)} · {AUDIENCE_LABELS[item.audienceType]} · {item.stats.readCount}/{item.stats.targetCount} citiri
                  </span>
                  <div className="ssm-badge-row">
                    <span className={`ssm-chip ${statusChip(item.status)}`}>{STATUS_LABELS[item.status]}</span>
                    <button className="btn-secondary" type="button" onClick={() => setOpenedAnnouncementId(item.id)}>
                      Deschide
                    </button>
                    {canEditAnnouncements ? (
                      <>
                    <button className="btn-secondary" type="button" onClick={() => runAnnouncementAction("publish", item.id)}>
                      Publică
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => runAnnouncementAction("retract", item.id)}>
                      Retrage
                    </button>
                    <button className="btn-secondary" type="button" onClick={() => runAnnouncementAction("duplicate", item.id)}>
                      Duplică
                    </button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
              {!announcementsQuery.isLoading && announcements.length === 0 ? <p className="field-hint">Nu există anunțuri definite.</p> : null}
            </div>
            <PaginationBar
              page={announcementsPaged.page}
              pageSize={announcementsPaged.pageSize}
              total={announcementsPaged.total}
              totalPages={announcementsPaged.totalPages}
              onPageChange={announcementsPage.setPage}
              onPageSizeChange={announcementsPage.setPageSize}
              disabled={announcementsQuery.isFetching}
            />
          </div>

          <div className="card ssm-doc-card">
            <div className="ssm-card-header">
              <div>
                <h3 className="card-title">Mementouri</h3>
                <p className="field-hint">Previzualizare pentru anunțurile cu memento planificat.</p>
              </div>
              {canEditAnnouncements ? (
              <button className="btn-secondary" type="button" onClick={() => dispatchReminders.mutate()} disabled={dispatchReminders.isPending}>
                Trimite mementourile scadente
              </button>
              ) : null}
            </div>
            <div className="ssm-doc-items">
              {reminders.map((item) => (
                <article key={item.announcementId} className="ssm-doc-item">
                  <strong>{item.title}</strong>
                  <span>
                    memento {formatDate(item.reminderAt)} · necitite {item.unreadCount} · citire {item.readRate}%
                  </span>
                </article>
              ))}
              {!remindersQuery.isLoading && reminders.length === 0 ? <p className="field-hint">Nu există mementouri active.</p> : null}
            </div>
            {dispatchReminders.isSuccess ? <div className="feedback success">Mementouri trimise: {dispatchReminders.data.sent}</div> : null}
            {dispatchReminders.isError ? <div className="feedback error" role="alert">{mutationErrorMessage(dispatchReminders.error)}</div> : null}
          </div>
        </div>

        {canEditTemplates ? (
        <form className="card form-stack ssm-doc-card ssm-documents" onSubmit={onTemplateSubmit}>
          <div className="ssm-card-header">
            <div>
              <h3 className="card-title">Șabloane comunicări</h3>
              <p className="field-hint">Șabloane reutilizabile pentru mesaje recurente.</p>
            </div>
            <span className="ssm-chip">{templatesQuery.data?.items.length ?? 0} șabloane</span>
          </div>
          <div className="ssm-form-grid">
            <div className="field">
              <label htmlFor="template-name">Nume șablon</label>
              <input id="template-name" value={templateForm.name} onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))} required />
            </div>
            <FieldSelect
              id="template-content-type"
              label="Tip"
              value={templateForm.contentType}
              onChange={(contentType) =>
                setTemplateForm((prev) => ({ ...prev, contentType: contentType as CommunicationContentType }))
              }
              options={stringOptions(CONTENT_TYPES, (type) => CONTENT_TYPE_LABELS[type])}
            />
            <div className="field wide">
              <label htmlFor="template-title">Titlu</label>
              <input id="template-title" value={templateForm.title} onChange={(event) => setTemplateForm((prev) => ({ ...prev, title: event.target.value }))} required />
            </div>
            <div className="field wide">
              <label htmlFor="template-body">Mesaj</label>
              <textarea id="template-body" value={templateForm.body} onChange={(event) => setTemplateForm((prev) => ({ ...prev, body: event.target.value }))} required />
            </div>
          </div>
          <button className="btn-primary" type="submit" disabled={createTemplate.isPending}>
            {createTemplate.isPending ? "Se salvează..." : "Salvează șablon"}
          </button>
          {templateFeedback ? (
            <div className={`feedback ${templateFeedback.type}`} role={templateFeedback.type === "error" ? "alert" : "status"}>
              {templateFeedback.message}
            </div>
          ) : null}
        </form>
        ) : null}
      </section>

      {openedAnnouncement ? (
        <div className="ticket-detail-backdrop" role="presentation" onClick={() => setOpenedAnnouncementId("")}>
          <div
            className="ticket-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ssm-card-header">
              <div>
                <p className="ssm-card-eyebrow">Anunț</p>
                <h4 id="announcement-detail-title" className="card-title">
                  {openedAnnouncement.title}
                </h4>
                <p className="field-hint">
                  <span className={`ssm-chip ${statusChip(openedAnnouncement.status)}`}>
                    {STATUS_LABELS[openedAnnouncement.status]}
                  </span>{" "}
                  · {CONTENT_TYPE_LABELS[openedAnnouncement.contentType]} · {AUDIENCE_LABELS[openedAnnouncement.audienceType]}
                  {openedAnnouncement.audienceLabel ? ` · ${openedAnnouncement.audienceLabel}` : ""}
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setOpenedAnnouncementId("")}>
                Închide
              </button>
            </div>

            <p className="ticket-detail-description announcement-detail-body">{openedAnnouncement.body}</p>

            {openedAnnouncement.contentUrl ? (
              <p className="field-hint">
                Link / document:{" "}
                <a href={openedAnnouncement.contentUrl} target="_blank" rel="noreferrer">
                  {openedAnnouncement.contentUrl}
                </a>
              </p>
            ) : null}

            <div className="ticket-detail-grid announcement-detail-grid">
              <div>
                <span>Publicat / programat</span>
                <strong>{formatDate(openedAnnouncement.publishAt)}</strong>
              </div>
              <div>
                <span>Expiră</span>
                <strong>{formatDate(openedAnnouncement.expiresAt)}</strong>
              </div>
              <div>
                <span>Memento</span>
                <strong>{formatDate(openedAnnouncement.reminderAt)}</strong>
              </div>
              <div>
                <span>Citiri</span>
                <strong>
                  {openedAnnouncement.stats.readCount}/{openedAnnouncement.stats.targetCount} ({openedAnnouncement.stats.readRate}%)
                </strong>
              </div>
            </div>

            <div className="ssm-progress" aria-label={`Citire ${openedAnnouncement.stats.readRate}%`}>
              <span style={{ width: `${Math.max(0, Math.min(openedAnnouncement.stats.readRate, 100))}%` }} />
            </div>

            <div className="ssm-badge-row" style={{ marginTop: "1rem" }}>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => runAnnouncementAction("publish", openedAnnouncement.id)}
              >
                Publică
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => runAnnouncementAction("retract", openedAnnouncement.id)}
              >
                Retrage
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => runAnnouncementAction("duplicate", openedAnnouncement.id)}
              >
                Duplică
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
