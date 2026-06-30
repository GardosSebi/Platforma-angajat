import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { isWorksiteScopedViewer } from "../../../shared/auth/worksite-scope";
import type {
  CommunicationAnnouncementItem,
  CreateCommunicationAnnouncementRequest,
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
import { useQuery } from "@tanstack/react-query";
import { masterDataApi } from "../../master-data/api/master-data.api";
import { surveysApi } from "../../surveys/api/surveys.api";
import {
  useAnnouncements,
  useChatbotDashboard,
  useCommunicationCalendar,
  useCommunicationReminders,
  useCommunicationTemplates,
  useCreateAnnouncement,
  useCreateCommunicationTemplate,
  useDispatchCommunicationReminders,
  useDuplicateAnnouncement,
  usePublishAnnouncement,
  useRetractAnnouncement,
  useUsageSummary
} from "../hooks/useChatbot";
import {
  AUDIENCE_TYPES,
  type CommsTab,
  mutationErrorMessage
} from "../comms-shared";
import { CommsAnnouncementDetail } from "../components/CommsAnnouncementDetail";
import { CommsAnnouncementForm, type AnnouncementFormState } from "../components/CommsAnnouncementForm";
import { CommsAnnouncementList } from "../components/CommsAnnouncementList";
import { CommsCalendarPanel } from "../components/CommsCalendarPanel";
import { CommsLatestPanel } from "../components/CommsLatestPanel";
import { CommsUsagePanel } from "../components/CommsUsagePanel";
import { CommsRemindersPanel } from "../components/CommsRemindersPanel";
import { CommsTemplatesPanel } from "../components/CommsTemplatesPanel";

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
  const session = useAuthSession();
  const roles = session?.roles;
  const canViewDashboard = hasPermission(roles, "communications:dashboard:view");
  const canEditAnnouncements = hasPermission(roles, "communications:announcements:edit");
  const canEditTemplates = hasPermission(roles, "communications:templates:edit");
  const canViewUsage = hasPermission(roles, "admin:usage:view");
  const worksiteRestricted = isWorksiteScopedViewer(session?.roles);

  const audienceTypesForForm = useMemo(
    () => (worksiteRestricted ? AUDIENCE_TYPES.filter((t) => t !== "ALL") : AUDIENCE_TYPES),
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
  const publishAnnouncement = usePublishAnnouncement();
  const retractAnnouncement = useRetractAnnouncement();
  const duplicateAnnouncement = useDuplicateAnnouncement();
  const dispatchReminders = useDispatchCommunicationReminders();
  const createTemplate = useCreateCommunicationTemplate();

  const [tab, setTab] = useState<CommsTab>("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementFormState>(EMPTY_ANNOUNCEMENT);
  const [templateForm, setTemplateForm] = useState<CreateCommunicationTemplateRequest>(EMPTY_TEMPLATE);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [announcementFeedback, setAnnouncementFeedback] = useState<FeedbackState | null>(null);
  const [templateFeedback, setTemplateFeedback] = useState<FeedbackState | null>(null);
  const [actionFeedback, setActionFeedback] = useState<FeedbackState | null>(null);
  const [openedAnnouncementId, setOpenedAnnouncementId] = useState("");

  useEffect(() => {
    if (!worksiteRestricted) return;
    setAnnouncementForm((prev) =>
      prev.audienceType === "ALL" ? { ...prev, audienceType: "WORKSITE" } : prev
    );
    setTemplateForm((prev) => (prev.audienceType === "ALL" ? { ...prev, audienceType: "WORKSITE" } : prev));
  }, [worksiteRestricted]);

  const latest = dashboardQuery.data?.latestAnnouncements ?? [];
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

  const announcementById = useMemo(() => {
    const map = new Map<string, CommunicationAnnouncementItem>();
    for (const item of [...announcementsPaged.items, ...latest]) {
      map.set(item.id, item);
    }
    return map;
  }, [announcementsPaged.items, latest]);

  const openedAnnouncement = openedAnnouncementId ? announcementById.get(openedAnnouncementId) : undefined;
  const reminders = remindersQuery.data ?? [];
  const kpi = dashboardQuery.data?.kpi;
  const templates = templatesQuery.data?.items ?? [];

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
    const items: Array<{ id: CommsTab; label: string }> = [{ id: "list", label: "Anunțuri" }];
    if (canEditAnnouncements) items.push({ id: "compose", label: "Anunț nou" });
    if (canEditTemplates) items.push({ id: "templates", label: "Șabloane" });
    if (canViewDashboard) items.push({ id: "calendar", label: "Calendar" });
    if (canViewUsage) items.push({ id: "usage", label: "Rapoarte" });
    if (canEditAnnouncements || reminders.length > 0) {
      items.push({ id: "reminders", label: `Mementouri${reminders.length ? ` (${reminders.length})` : ""}` });
    }
    return items;
  }, [canEditAnnouncements, canEditTemplates, canViewDashboard, canViewUsage, reminders.length]);

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
    setTab("compose");
  };

  const onAnnouncementSubmit = (event: FormEvent) => {
    event.preventDefault();
    setAnnouncementFeedback(null);
    const { targetEmployeeIdsCsv, translationRoTitle, translationRoBody, translationEnTitle, translationEnBody, ...form } =
      announcementForm;
    const translations: CreateCommunicationAnnouncementRequest["translations"] = {};
    if (translationRoTitle.trim() || translationRoBody.trim()) {
      translations.ro = { title: translationRoTitle.trim() || announcementForm.title, body: translationRoBody.trim() || announcementForm.body };
    }
    if (translationEnTitle.trim() || translationEnBody.trim()) {
      translations.en = { title: translationEnTitle.trim(), body: translationEnBody.trim() };
    }
    const payload: CreateCommunicationAnnouncementRequest = {
      ...form,
      title: announcementForm.title.trim(),
      body: announcementForm.body.trim(),
      contentUrl: announcementForm.contentUrl || undefined,
      linkedSurveyId: announcementForm.linkedSurveyId || undefined,
      buttonLabel: announcementForm.buttonLabel || undefined,
      buttonUrl: announcementForm.buttonUrl || undefined,
      translations: Object.keys(translations).length ? translations : undefined,
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
        setAnnouncementFeedback({ type: "success", message: "Anunț salvat. Poți continua din listă." });
        setTab("list");
      },
      onError: (error) => {
        setAnnouncementFeedback({ type: "error", message: mutationErrorMessage(error) });
      }
    });
  };

  const onTemplateSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTemplateFeedback(null);
    createTemplate.mutate(
      {
        ...templateForm,
        contentUrl: templateForm.contentUrl || undefined,
        audienceRefId: templateForm.audienceRefId || undefined,
        audienceLabel: templateForm.audienceLabel || undefined
      },
      {
        onSuccess: () => {
          setTemplateForm(EMPTY_TEMPLATE);
          setTemplateFeedback({ type: "success", message: "Șablon salvat." });
        },
        onError: (error) => {
          setTemplateFeedback({ type: "error", message: mutationErrorMessage(error) });
        }
      }
    );
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
          <h1 className="page-title">Comunicări</h1>
          <p className="page-lead">Publică mesaje, programează mementouri și urmărește rata de citire.</p>
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

      {canViewDashboard && latest.length ? (
        <CommsLatestPanel
          items={latest}
          onOpen={(id) => {
            setOpenedAnnouncementId(id);
            setTab("list");
          }}
        />
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
          onPublish={(id) => runAnnouncementAction("publish", id)}
          onRetract={(id) => runAnnouncementAction("retract", id)}
          onDuplicate={(id) => runAnnouncementAction("duplicate", id)}
        />
      ) : null}

      {tab === "compose" && canEditAnnouncements ? (
        <CommsAnnouncementForm
          form={announcementForm}
          templates={templates.map((t) => ({ id: t.id, name: t.name }))}
          audienceTypes={audienceTypesForForm}
          audienceOptions={audienceOptions}
          employeeNameHint={employeeNameHint}
          isPending={createAnnouncement.isPending}
          feedback={announcementFeedback}
          selectedTemplateId={selectedTemplateId}
          onTemplateSelect={selectTemplate}
          onChange={(patch) => setAnnouncementForm((prev) => ({ ...prev, ...patch }))}
          onAudienceRefChange={onAudienceRefChange}
          surveyOptions={(surveysLookup.data?.items ?? []).map((s) => ({ id: s.id, title: s.title }))}
          onSubmit={onAnnouncementSubmit}
          onCancel={() => setTab("list")}
        />
      ) : null}

      {tab === "templates" && canEditTemplates ? (
        <CommsTemplatesPanel
          form={templateForm}
          templateCount={templates.length}
          isPending={createTemplate.isPending}
          feedback={templateFeedback}
          onChange={(patch) => setTemplateForm((prev) => ({ ...prev, ...patch }))}
          onSubmit={onTemplateSubmit}
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

      {openedAnnouncement ? (
        <CommsAnnouncementDetail
          announcement={openedAnnouncement}
          canEdit={canEditAnnouncements}
          onClose={() => setOpenedAnnouncementId("")}
          onPublish={() => runAnnouncementAction("publish", openedAnnouncement.id)}
          onRetract={() => runAnnouncementAction("retract", openedAnnouncement.id)}
          onDuplicate={() => runAnnouncementAction("duplicate", openedAnnouncement.id)}
        />
      ) : null}
    </div>
  );
}
