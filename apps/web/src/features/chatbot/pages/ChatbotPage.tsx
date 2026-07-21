import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { isWorksiteScopedViewer } from "../../../shared/auth/worksite-scope";
import type {
  CommunicationTemplateItem,
  CreateCommunicationTemplateRequest
} from "@repo/shared-types/communications";
import {
  useDepartmentsLookup,
  useEmployeeOptions,
  useJobPositionsLookup,
  useWorksitesLookup
} from "../../master-data/hooks/useMasterData";
import { paginationFromResult } from "../../../shared/components/PaginationBar";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { masterDataApi } from "../../master-data/api/master-data.api";
import { surveysApi } from "../../surveys/api/surveys.api";
import { chatbotApi } from "../api/chatbot.api";
import {
  useAnnouncement,
  useAnnouncements,
  useChatbotDashboard,
  useCommunicationCalendar,
  useCommunicationReminders,
  useCommunicationTemplates,
  useCreateAnnouncement,
  useCreateCommunicationTemplate,
  useDeleteAnnouncement,
  useDeleteCommunicationTemplate,
  useDispatchCommunicationReminders,
  useDuplicateAnnouncement,
  usePublishAnnouncement,
  useRetractAnnouncement,
  useUpdateAnnouncement,
  useUpdateCommunicationTemplate,
  useUsageSummary
} from "../hooks/useChatbot";
import {
  AUDIENCE_TYPES,
  announcementToForm,
  buildAnnouncementPayload,
  canDeleteAnnouncement,
  type CommsTab,
  mutationErrorMessage
} from "../comms-shared";
import { CommsAnnouncementDetail } from "../components/CommsAnnouncementDetail";
import { CommsAnnouncementForm, type AnnouncementFormState } from "../components/CommsAnnouncementForm";
import { CommsAnnouncementList } from "../components/CommsAnnouncementList";
import { CommsCalendarPanel } from "../components/CommsCalendarPanel";
import { CommsUsagePanel } from "../components/CommsUsagePanel";
import { CommsRemindersPanel } from "../components/CommsRemindersPanel";
import { CommsTemplatesPanel } from "../components/CommsTemplatesPanel";
import { CommsPublishRightsPanel } from "../components/CommsPublishRightsPanel";

type FeedbackState = {
  type: "success" | "error";
  message: string;
};

const EMPTY_ANNOUNCEMENT: AnnouncementFormState = {
  title: "",
  body: "",
  category: "GENERAL",
  contentType: "TEXT",
  messageType: "ANNOUNCEMENT",
  audienceType: "ALL",
  status: "DRAFT",
  publishAt: "",
  expiresAt: "",
  reminderAt: "",
  contentUrl: "",
  reactionsEnabled: false,
  targetEmployeeIdsCsv: "",
  translationRoTitle: "",
  translationRoBody: "",
  translationEnTitle: "",
  translationEnBody: ""
};

const EMPTY_TEMPLATE: CreateCommunicationTemplateRequest = {
  name: "",
  title: "",
  body: "",
  contentType: "TEXT",
  audienceType: "ALL",
  contentUrl: ""
};

export function ChatbotPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const session = useAuthSession();
  const roles = session?.roles;
  const canViewDashboard = hasPermission(roles, "communications:dashboard:view");
  const canEditAnnouncements = hasPermission(roles, "communications:announcements:edit");
  const canEditTemplates = hasPermission(roles, "communications:templates:edit");
  const canViewUsage = hasPermission(roles, "admin:usage:view");
  const canManagePublishRights =
    Boolean(session?.roles?.includes("SSM_ADMIN")) || hasPermission(roles, "admin:users:edit");
  const worksiteRestricted = isWorksiteScopedViewer(session?.roles);

  const audienceTypesForForm = useMemo(
    () => (worksiteRestricted ? AUDIENCE_TYPES.filter((type) => type !== "ALL") : AUDIENCE_TYPES),
    [worksiteRestricted]
  );

  const announcementsPage = usePagination();
  const dashboardQuery = useChatbotDashboard(canViewDashboard);
  const announcementsQuery = useAnnouncements(announcementsPage.params);
  const templatesQuery = useCommunicationTemplates();
  const remindersQuery = useCommunicationReminders();
  const calendarQuery = useCommunicationCalendar(canViewDashboard);
  const usageQuery = useUsageSummary(canViewUsage);
  const groupsLookup = useQuery({
    queryKey: ["master-data", "groups-lookup"],
    queryFn: () => masterDataApi.listGroups({ page: 1, pageSize: 200 })
  });
  const surveysLookup = useQuery({
    queryKey: ["surveys", "lookup"],
    queryFn: () => surveysApi.listSurveys({ page: 1, pageSize: 100 })
  });
  const worksitesLookup = useWorksitesLookup();
  const departmentsLookup = useDepartmentsLookup();
  const jobPositionsLookup = useJobPositionsLookup();
  const employeesOptions = useEmployeeOptions();

  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();
  const publishAnnouncement = usePublishAnnouncement();
  const retractAnnouncement = useRetractAnnouncement();
  const duplicateAnnouncement = useDuplicateAnnouncement();
  const dispatchReminders = useDispatchCommunicationReminders();
  const createTemplate = useCreateCommunicationTemplate();
  const updateTemplate = useUpdateCommunicationTemplate();
  const deleteTemplate = useDeleteCommunicationTemplate();

  const [tab, setTab] = useState<CommsTab>("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementFormState>(EMPTY_ANNOUNCEMENT);
  const [templateForm, setTemplateForm] = useState<CreateCommunicationTemplateRequest>(EMPTY_TEMPLATE);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [announcementFeedback, setAnnouncementFeedback] = useState<FeedbackState | null>(null);
  const [templateFeedback, setTemplateFeedback] = useState<FeedbackState | null>(null);
  const [actionFeedback, setActionFeedback] = useState<FeedbackState | null>(null);
  const [openedAnnouncementId, setOpenedAnnouncementId] = useState("");
  const [editingAnnouncementId, setEditingAnnouncementId] = useState("");

  const openedAnnouncementQuery = useAnnouncement(openedAnnouncementId, Boolean(openedAnnouncementId));

  useEffect(() => {
    if (!worksiteRestricted) return;
    setAnnouncementForm((prev) =>
      prev.audienceType === "ALL" ? { ...prev, audienceType: "WORKSITE" } : prev
    );
    setTemplateForm((prev) => (prev.audienceType === "ALL" ? { ...prev, audienceType: "WORKSITE" } : prev));
  }, [worksiteRestricted]);

  const announcementsPaged = paginationFromResult(
    announcementsQuery.data,
    announcementsPage.page,
    announcementsPage.pageSize
  );

  const filteredAnnouncements = useMemo(() => {
    const query = search.trim().toLowerCase();
    return announcementsPaged.items.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (!query) return true;
      const haystack = [item.title, item.body, item.audienceLabel ?? ""].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [announcementsPaged.items, search, statusFilter]);

  const reminders = remindersQuery.data ?? [];
  const kpi = dashboardQuery.data?.kpi;
  const templates = templatesQuery.data?.items ?? [];

  const editingAnnouncement = useMemo(
    () => filteredAnnouncements.find((item) => item.id === editingAnnouncementId),
    [editingAnnouncementId, filteredAnnouncements]
  );

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
    if (announcementForm.audienceType === "EMPLOYEE_GROUP") {
      return (groupsLookup.data?.items ?? []).map((item) => ({ id: item.id, label: item.name }));
    }
    return [];
  }, [
    announcementForm.audienceType,
    departmentsLookup.data?.items,
    employeesOptions.data?.items,
    groupsLookup.data?.items,
    jobPositionsLookup.data?.items,
    worksitesLookup.data?.items
  ]);

  const employeeNameHint = (employeesOptions.data?.items ?? [])
    .slice(0, 3)
    .map((item) => item.fullName)
    .join(", ");

  const tabs = useMemo(() => {
    const items: Array<{ id: CommsTab; label: string }> = [
      { id: "list", label: t("comms.tabs.announcements") }
    ];
    if (canEditAnnouncements) {
      items.push({
        id: "compose",
        label: editingAnnouncementId ? t("comms.tabs.editCompose") : t("comms.tabs.compose")
      });
    }
    if (canEditTemplates) items.push({ id: "templates", label: t("comms.tabs.templates") });
    if (canViewDashboard) items.push({ id: "calendar", label: t("comms.tabs.calendar") });
    if (canViewUsage) items.push({ id: "usage", label: t("comms.tabs.usage") });
    if (canManagePublishRights) items.push({ id: "rights", label: t("comms.tabs.rights") });
    if (canEditAnnouncements || reminders.length > 0) {
      items.push({
        id: "reminders",
        label: `${t("comms.tabs.reminders")}${reminders.length ? ` (${reminders.length})` : ""}`
      });
    }
    return items;
  }, [
    canEditAnnouncements,
    canEditTemplates,
    canManagePublishRights,
    canViewDashboard,
    canViewUsage,
    editingAnnouncementId,
    reminders.length,
    t
  ]);

  const resetCompose = () => {
    setAnnouncementForm(EMPTY_ANNOUNCEMENT);
    setSelectedTemplateId("");
    setEditingAnnouncementId("");
    setAnnouncementFeedback(null);
    setTab("list");
  };

  const resetTemplateForm = () => {
    setTemplateForm(EMPTY_TEMPLATE);
    setEditingTemplateId(null);
    setTemplateFeedback(null);
  };

  const selectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
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

  const openCompose = () => {
    setAnnouncementFeedback(null);
    setEditingAnnouncementId("");
    setAnnouncementForm(EMPTY_ANNOUNCEMENT);
    setSelectedTemplateId("");
    setTab("compose");
  };

  const openEdit = async (announcementId: string) => {
    setAnnouncementFeedback(null);
    setOpenedAnnouncementId("");
    try {
      const item = await queryClient.fetchQuery({
        queryKey: ["chatbot", "announcement", announcementId],
        queryFn: () => chatbotApi.getAnnouncement(announcementId)
      });
      setAnnouncementForm(announcementToForm(item));
      setSelectedTemplateId(item.templateId ?? "");
      setEditingAnnouncementId(announcementId);
      setTab("compose");
    } catch (error) {
      setActionFeedback({ type: "error", message: mutationErrorMessage(error) });
    }
  };

  const onAnnouncementSubmit = (event: FormEvent) => {
    event.preventDefault();
    setAnnouncementFeedback(null);
    const payload = buildAnnouncementPayload(announcementForm);
    const isEdit = Boolean(editingAnnouncementId);
    const onSuccess = () => {
      const message = isEdit ? "Anunț actualizat." : "Anunț salvat. Poți continua din listă.";
      resetCompose();
      setActionFeedback({ type: "success", message });
    };
    const onError = (error: unknown) => {
      setAnnouncementFeedback({ type: "error", message: mutationErrorMessage(error) });
    };

    if (editingAnnouncementId) {
      updateAnnouncement.mutate({ id: editingAnnouncementId, payload }, { onSuccess, onError });
      return;
    }

    createAnnouncement.mutate(payload, {
      onSuccess,
      onError
    });
  };

  const onEditTemplate = (template: CommunicationTemplateItem) => {
    setEditingTemplateId(template.id);
    setTemplateForm({
      name: template.name,
      title: template.title,
      body: template.body,
      category: template.category,
      contentType: template.contentType,
      contentUrl: template.contentUrl ?? "",
      audienceType: template.audienceType,
      audienceRefId: template.audienceRefId ?? "",
      audienceLabel: template.audienceLabel ?? "",
      active: template.active
    });
    setTemplateFeedback(null);
  };

  const onTemplateSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTemplateFeedback(null);
    const payload = {
      ...templateForm,
      contentUrl: templateForm.contentUrl || undefined,
      audienceRefId: templateForm.audienceRefId || undefined,
      audienceLabel: templateForm.audienceLabel || undefined
    };
    const onError = (error: unknown) => {
      setTemplateFeedback({ type: "error", message: mutationErrorMessage(error) });
    };

    if (editingTemplateId) {
      updateTemplate.mutate(
        { id: editingTemplateId, payload },
        {
          onSuccess: () => {
            setTemplateForm(EMPTY_TEMPLATE);
            setEditingTemplateId(null);
            setTemplateFeedback({ type: "success", message: "Șablon actualizat." });
          },
          onError
        }
      );
      return;
    }

    createTemplate.mutate(payload, {
      onSuccess: () => {
        setTemplateForm(EMPTY_TEMPLATE);
        setTemplateFeedback({ type: "success", message: "Șablon salvat." });
      },
      onError
    });
  };

  const onDeleteTemplate = (id: string) => {
    if (!window.confirm("Sigur vrei să ștergi acest șablon?")) return;
    setTemplateFeedback(null);
    deleteTemplate.mutate(id, {
      onSuccess: () => {
        if (editingTemplateId === id) {
          resetTemplateForm();
        }
        setTemplateFeedback({ type: "success", message: "Șablon șters." });
      },
      onError: (error: unknown) => {
        setTemplateFeedback({ type: "error", message: mutationErrorMessage(error) });
      }
    });
  };

  const runDelete = (announcementId: string) => {
    if (!window.confirm("Sigur vrei să ștergi acest anunț? Acțiunea nu poate fi anulată.")) return;
    setActionFeedback(null);
    deleteAnnouncement.mutate(announcementId, {
      onSuccess: () => {
        setOpenedAnnouncementId("");
        if (editingAnnouncementId === announcementId) {
          resetCompose();
        }
        setActionFeedback({ type: "success", message: "Anunț șters." });
      },
      onError: (error: unknown) => setActionFeedback({ type: "error", message: mutationErrorMessage(error) })
    });
  };

  const runAnnouncementAction = (action: "publish" | "retract" | "duplicate", announcementId: string) => {
    setActionFeedback(null);
    const labels = {
      publish: "Anunț publicat.",
      retract: "Anunț retras.",
      duplicate: "Anunț duplicat — verifică lista."
    };
    const options = {
      onSuccess: () => {
        setActionFeedback({ type: "success", message: labels[action] });
        if (action === "duplicate") setTab("list");
      },
      onError: (error: unknown) => setActionFeedback({ type: "error", message: mutationErrorMessage(error) })
    };
    if (action === "publish") publishAnnouncement.mutate(announcementId, options);
    if (action === "retract") retractAnnouncement.mutate(announcementId, options);
    if (action === "duplicate") duplicateAnnouncement.mutate(announcementId, options);
  };

  return (
    <div className="comms-page">
      <header className="comms-header">
        <div>
          <h1 className="page-title">{t("comms.title")}</h1>
          <p className="page-lead">{t("comms.lead")}</p>
        </div>
      </header>

      {worksiteRestricted ? (
        <p className="comms-notice" role="status">
          Vizibilitate limitată la punctul tău de lucru.
        </p>
      ) : null}

      {canViewDashboard && kpi ? (
        <div className="comms-kpi" aria-label="Rezumat">
          <div>
            <span>Digitalizare</span>
            <strong>{kpi.digitalizationRate}%</strong>
          </div>
          <div>
            <span>Utilizatori activi</span>
            <strong>{kpi.activeUsers}</strong>
          </div>
          <div>
            <span>Rată citire</span>
            <strong>{kpi.readRate}%</strong>
          </div>
          <div>
            <span>Anunțuri active</span>
            <strong>{kpi.activeAnnouncements}</strong>
          </div>
          <div>
            <span>Angajați activi</span>
            <strong>{kpi.activeEmployees}</strong>
          </div>
        </div>
      ) : null}

      <nav className="comms-tabs comms-section-nav" aria-label="Secțiuni comunicări">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`comms-tab${tab === item.id ? " active" : ""}`}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "list" ? (
        <CommsAnnouncementList
          items={filteredAnnouncements}
          total={announcementsPaged.total}
          page={announcementsPaged.page}
          pageSize={announcementsPaged.pageSize}
          totalPages={announcementsPaged.totalPages}
          isLoading={announcementsQuery.isLoading}
          isFetching={announcementsQuery.isFetching}
          canEdit={canEditAnnouncements}
          search={search}
          statusFilter={statusFilter}
          selectedId={openedAnnouncementId}
          feedback={actionFeedback}
          onSearchChange={setSearch}
          onStatusFilterChange={setStatusFilter}
          onPageChange={announcementsPage.setPage}
          onPageSizeChange={announcementsPage.setPageSize}
          onSelect={setOpenedAnnouncementId}
          onCreateClick={openCompose}
          onEdit={openEdit}
          onPublish={(id) => runAnnouncementAction("publish", id)}
          onRetract={(id) => runAnnouncementAction("retract", id)}
          onDuplicate={(id) => runAnnouncementAction("duplicate", id)}
          onDelete={runDelete}
        />
      ) : null}

      {tab === "compose" && canEditAnnouncements ? (
        <CommsAnnouncementForm
          mode={editingAnnouncementId ? "edit" : "create"}
          form={announcementForm}
          templates={templates.map((tmpl) => ({ id: tmpl.id, name: tmpl.name }))}
          audienceTypes={audienceTypesForForm}
          audienceOptions={audienceOptions}
          employeeNameHint={employeeNameHint}
          isPending={createAnnouncement.isPending || updateAnnouncement.isPending}
          feedback={announcementFeedback}
          selectedTemplateId={selectedTemplateId}
          onTemplateSelect={selectTemplate}
          onChange={(patch) => setAnnouncementForm((prev) => ({ ...prev, ...patch }))}
          onAudienceRefChange={onAudienceRefChange}
          surveyOptions={(surveysLookup.data?.items ?? []).map((s) => ({ id: s.id, title: s.title }))}
          onSubmit={onAnnouncementSubmit}
          onCancel={resetCompose}
          canDelete={editingAnnouncement ? canDeleteAnnouncement(editingAnnouncement.status) : false}
          onDelete={editingAnnouncementId ? () => runDelete(editingAnnouncementId) : undefined}
        />
      ) : null}

      {tab === "templates" && canEditTemplates ? (
        <CommsTemplatesPanel
          templates={templates}
          form={templateForm}
          isPending={createTemplate.isPending || updateTemplate.isPending || deleteTemplate.isPending}
          feedback={templateFeedback}
          onChange={(patch) => setTemplateForm((prev) => ({ ...prev, ...patch }))}
          onSubmit={onTemplateSubmit}
          editingId={editingTemplateId}
          onEdit={onEditTemplate}
          onCancelEdit={resetTemplateForm}
          onDelete={onDeleteTemplate}
        />
      ) : null}

      {tab === "calendar" && canViewDashboard ? (
        <CommsCalendarPanel
          items={calendarQuery.data?.items ?? dashboardQuery.data?.calendar ?? []}
          isLoading={calendarQuery.isLoading}
          onOpenAnnouncement={(id) => {
            setOpenedAnnouncementId(id);
            setTab("list");
          }}
        />
      ) : null}

      {tab === "usage" && canViewUsage ? (
        <CommsUsagePanel data={usageQuery.data} isLoading={usageQuery.isLoading} />
      ) : null}

      {tab === "rights" && canManagePublishRights ? <CommsPublishRightsPanel /> : null}

      {tab === "reminders" ? (
        <CommsRemindersPanel
          reminders={reminders}
          isLoading={remindersQuery.isLoading}
          canEdit={canEditAnnouncements}
          isDispatchPending={dispatchReminders.isPending}
          dispatchSent={dispatchReminders.isSuccess ? dispatchReminders.data.sent : null}
          dispatchError={dispatchReminders.isError ? dispatchReminders.error : null}
          onDispatch={() => dispatchReminders.mutate()}
          onOpenAnnouncement={(id) => {
            setOpenedAnnouncementId(id);
            setTab("list");
          }}
        />
      ) : null}

      {openedAnnouncementId ? (
        <CommsAnnouncementDetail
          announcement={openedAnnouncementQuery.data}
          isLoading={openedAnnouncementQuery.isLoading}
          error={
            openedAnnouncementQuery.error instanceof Error ? mutationErrorMessage(openedAnnouncementQuery.error) : null
          }
          canEdit={canEditAnnouncements}
          onClose={() => setOpenedAnnouncementId("")}
          onEdit={() => void openEdit(openedAnnouncementId)}
          onPublish={() => runAnnouncementAction("publish", openedAnnouncementId)}
          onRetract={() => runAnnouncementAction("retract", openedAnnouncementId)}
          onDuplicate={() => runAnnouncementAction("duplicate", openedAnnouncementId)}
          onDelete={() => runDelete(openedAnnouncementId)}
        />
      ) : null}
    </div>
  );
}
