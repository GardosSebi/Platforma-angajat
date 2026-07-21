import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasPermission } from "../../../shared/auth/effective-permissions";
import { useAuthSession } from "../../../shared/auth/use-auth-session";
import type { CreateSurveyRequest, SurveyConditionalRule, SurveyItem, SurveyQuestion, SurveyQuestionOption, UpdateSurveyRequest } from "@repo/shared-types/surveys";
import { surveyQuestionNeedsOptions } from "@repo/shared-types/surveys";
import { downloadWithAuth } from "../../../shared/api/http-download";
import {
  useDepartmentsLookup,
  useEmployeeOptions,
  useJobPositionsLookup,
  useWorksitesLookup
} from "../../master-data/hooks/useMasterData";
import { paginationFromResult } from "../../../shared/components/PaginationBar";
import { usePagination } from "../../../shared/hooks/use-pagination";
import { surveysApi } from "../api/surveys.api";
import {
  useActivateSurvey,
  useCloseSurvey,
  useCreatePublicSurveyLink,
  useCreateSurvey,
  useRespondedSurveyIds,
  useSurveyStats,
  useSurveys,
  useSurveysOverview,
  useUpdateSurvey
} from "../hooks/useSurveys";
import { SurveyCreateForm, type QuestionFormState, type SurveyFormState } from "../components/SurveyCreateForm";
import { SurveyListPanel } from "../components/SurveyListPanel";
import { SurveyManagePanel } from "../components/SurveyManagePanel";
import { mutationErrorMessage, type SurveyTab } from "../surveys-shared";

const EMPTY_SURVEY: SurveyFormState = {
  title: "",
  description: "",
  surveyType: "ENGAGEMENT",
  audienceType: "ALL",
  audienceRefId: "",
  audienceLabel: "",
  targetEmployeeIdsCsv: "",
  privateLinkEnabled: true,
  anonymousMode: false,
  emailNotifyOnPublish: false,
  autoCreateTicket: false,
  autoTicketTitle: "",
  autoTicketCategory: "",
  translationRoTitle: "",
  translationEnTitle: "",
  closesAtInput: ""
};

const EMPTY_QUESTION: QuestionFormState = {
  id: "q1",
  type: "SINGLE_CHOICE",
  title: "",
  required: true,
  options: [
    { value: "Foarte bine", label: "Foarte bine" },
    { value: "Bine", label: "Bine" },
    { value: "Necesită îmbunătățiri", label: "Necesită îmbunătățiri" }
  ],
  min: 1,
  max: 5,
  multiTextCount: 3
};

function cleanOptions(options: SurveyQuestionOption[]): SurveyQuestionOption[] {
  return options
    .map((option) => {
      const label = option.label.trim();
      if (!label) return null;
      const imageUrl = option.imageUrl?.trim();
      return {
        value: label,
        label,
        ...(imageUrl ? { imageUrl } : {})
      };
    })
    .filter((option): option is SurveyQuestionOption => option !== null);
}

function canOpenSurveyToComplete(roles: string[] | undefined): boolean {
  return hasPermission(roles, "surveys:respond") || hasPermission(roles, "surveys:edit");
}

export function SurveysPage() {
  const navigate = useNavigate();
  const session = useAuthSession();
  const surveysPage = usePagination();
  const overviewQuery = useSurveysOverview();
  const surveysQuery = useSurveys(surveysPage.params);
  const worksitesLookup = useWorksitesLookup();
  const departmentsLookup = useDepartmentsLookup();
  const jobPositionsLookup = useJobPositionsLookup();
  const employeesOptions = useEmployeeOptions();

  const createSurvey = useCreateSurvey();
  const updateSurvey = useUpdateSurvey();
  const activateSurvey = useActivateSurvey();
  const closeSurvey = useCloseSurvey();
  const createPublicLink = useCreatePublicSurveyLink();

  const surveysPaged = paginationFromResult(surveysQuery.data, surveysPage.page, surveysPage.pageSize);
  const surveys = surveysPaged.items;

  const [tab, setTab] = useState<SurveyTab>("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [surveyForm, setSurveyForm] = useState<SurveyFormState>(EMPTY_SURVEY);
  const [questionForm, setQuestionForm] = useState<QuestionFormState>(EMPTY_QUESTION);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [conditionalLogic, setConditionalLogic] = useState<SurveyConditionalRule[]>([]);
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [selectedSurveyId, setSelectedSurveyId] = useState("");
  const [publicExpiresAt, setPublicExpiresAt] = useState("");
  const [publicResponseLimit, setPublicResponseLimit] = useState("100");
  const [listFeedback, setListFeedback] = useState<string | null>(null);
  const [createFeedback, setCreateFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [publicLinkError, setPublicLinkError] = useState<string | null>(null);
  const [openingSurveyId, setOpeningSurveyId] = useState<string | null>(null);

  const statsQuery = useSurveyStats(selectedSurveyId || undefined);
  const canComplete = canOpenSurveyToComplete(session?.roles);
  const respondedIdsQuery = useRespondedSurveyIds(canComplete);
  const respondedSurveyIds = respondedIdsQuery.data ?? new Set<string>();
  const kpi = overviewQuery.data?.kpi;
  const selectedSurvey = surveys.find((survey) => survey.id === selectedSurveyId);

  const currentQuestionOptions = cleanOptions(questionForm.options);
  const currentQuestionReady =
    questionForm.title.trim().length > 0 &&
    (!surveyQuestionNeedsOptions(questionForm.type) || currentQuestionOptions.length > 0);
  const canSaveSurvey = questions.length > 0 || currentQuestionReady;

  useEffect(() => {
    if (!selectedSurveyId && surveys.length > 0) {
      setSelectedSurveyId(surveys[0].id);
    }
  }, [selectedSurveyId, surveys]);

  const filteredSurveys = useMemo(() => {
    const query = search.trim().toLowerCase();
    return surveys.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (!query) return true;
      return item.title.toLowerCase().includes(query);
    });
  }, [surveys, search, statusFilter]);

  const audienceOptions = useMemo(() => {
    if (surveyForm.audienceType === "WORKSITE") {
      return (worksitesLookup.data?.items ?? []).map((item) => ({ id: item.id, label: `${item.code} - ${item.name}` }));
    }
    if (surveyForm.audienceType === "DEPARTMENT") {
      return (departmentsLookup.data?.items ?? []).map((item) => ({ id: item.id, label: `${item.code} - ${item.name}` }));
    }
    if (surveyForm.audienceType === "JOB_POSITION") {
      return (jobPositionsLookup.data?.items ?? []).map((item) => ({ id: item.id, label: `${item.code} - ${item.name}` }));
    }
    if (surveyForm.audienceType === "EMPLOYEE") {
      return (employeesOptions.data?.items ?? []).map((item) => ({ id: item.id, label: `${item.fullName} - ${item.email}` }));
    }
    return [];
  }, [
    departmentsLookup.data?.items,
    employeesOptions.data?.items,
    jobPositionsLookup.data?.items,
    surveyForm.audienceType,
    worksitesLookup.data?.items
  ]);

  const buildQuestionFromForm = (position: number): SurveyQuestion => ({
    id: `q${position}`,
    title: questionForm.title.trim(),
    type: questionForm.type,
    required: questionForm.required,
    options: surveyQuestionNeedsOptions(questionForm.type) ? cleanOptions(questionForm.options) : undefined,
    min: questionForm.type === "SCALE" ? questionForm.min : undefined,
    max: questionForm.type === "SCALE" ? questionForm.max : undefined,
    multiTextCount: questionForm.type === "MULTI_TEXT" ? questionForm.multiTextCount : undefined
  });

  const addQuestion = () => {
    setCreateFeedback(null);
    if (!currentQuestionReady) {
      setCreateFeedback({ type: "error", message: "Completează întrebarea și, dacă este cazul, opțiunile." });
      return;
    }
    setQuestions((prev) => [...prev, buildQuestionFromForm(prev.length + 1)]);
    setQuestionForm((prev) => ({ ...prev, id: `q${questions.length + 2}`, title: "" }));
  };

  const onAudienceRefChange = (value: string) => {
    const option = audienceOptions.find((item) => item.id === value);
    setSurveyForm((prev) => ({ ...prev, audienceRefId: value, audienceLabel: option?.label ?? "" }));
  };

  const resetCreateForm = () => {
    setEditingSurveyId(null);
    setSurveyForm(EMPTY_SURVEY);
    setQuestions([]);
    setConditionalLogic([]);
    setQuestionForm(EMPTY_QUESTION);
    setCreateFeedback(null);
  };

  const openCreate = () => {
    resetCreateForm();
    setTab("create");
  };

  const openEdit = (survey: SurveyItem) => {
    setCreateFeedback(null);
    setEditingSurveyId(survey.id);
    setSurveyForm({
      title: survey.title,
      description: survey.description ?? "",
      surveyType: survey.surveyType,
      audienceType: survey.audienceType,
      audienceRefId: survey.audienceRefId ?? "",
      audienceLabel: survey.audienceLabel ?? "",
      targetEmployeeIdsCsv: survey.targetEmployeeIds.join(", "),
      privateLinkEnabled: survey.privateLinkEnabled,
      anonymousMode: survey.anonymousMode,
      emailNotifyOnPublish: survey.emailNotifyOnPublish,
      autoCreateTicket: survey.autoCreateTicket,
      autoTicketTitle: survey.autoTicketTitle ?? "",
      autoTicketCategory: survey.autoTicketCategory ?? "",
      translationRoTitle: survey.translations?.ro?.title ?? "",
      translationEnTitle: survey.translations?.en?.title ?? "",
      closesAtInput: survey.closesAt ? survey.closesAt.slice(0, 10) : ""
    });
    setQuestions(survey.questionSchema);
    setConditionalLogic(survey.conditionalLogic ?? []);
    setQuestionForm(EMPTY_QUESTION);
    setSelectedSurveyId(survey.id);
    setTab("create");
  };

  const openManage = (surveyId: string) => {
    setSelectedSurveyId(surveyId);
    setListFeedback(null);
    setPublicLinkError(null);
    setDownloadError(null);
    setTab("manage");
  };

  const buildSurveyPayload = (): CreateSurveyRequest => {
    const questionSchema = questions.length > 0 ? questions : [buildQuestionFromForm(1)];
    const translations: CreateSurveyRequest["translations"] = {};
    if (surveyForm.translationRoTitle.trim()) {
      translations.ro = { title: surveyForm.translationRoTitle.trim(), description: surveyForm.description };
    }
    if (surveyForm.translationEnTitle.trim()) {
      translations.en = { title: surveyForm.translationEnTitle.trim() };
    }
    return {
      title: surveyForm.title.trim(),
      description: surveyForm.description?.trim() || undefined,
      surveyType: surveyForm.surveyType,
      closesAt: surveyForm.closesAtInput ? new Date(`${surveyForm.closesAtInput}T23:59:59`).toISOString() : undefined,
      audienceType: surveyForm.audienceType,
      audienceRefId: surveyForm.audienceRefId || undefined,
      audienceLabel: surveyForm.audienceLabel || undefined,
      targetEmployeeIds:
        surveyForm.audienceType === "CUSTOM"
          ? surveyForm.targetEmployeeIdsCsv.split(",").map((item) => item.trim()).filter(Boolean)
          : undefined,
      questionSchema,
      conditionalLogic: conditionalLogic.length ? conditionalLogic : undefined,
      translations: Object.keys(translations).length ? translations : undefined,
      privateLinkEnabled: surveyForm.privateLinkEnabled,
      anonymousMode: surveyForm.anonymousMode,
      emailNotifyOnPublish: surveyForm.emailNotifyOnPublish,
      autoCreateTicket: surveyForm.autoCreateTicket,
      autoTicketTitle: surveyForm.autoTicketTitle || undefined,
      autoTicketCategory: surveyForm.autoTicketCategory || undefined
    };
  };

  const onSurveySubmit = (event: FormEvent) => {
    event.preventDefault();
    setCreateFeedback(null);
    if (!canSaveSurvey) {
      setCreateFeedback({ type: "error", message: "Adaugă cel puțin o întrebare pentru a salva sondajul." });
      return;
    }
    const payload = buildSurveyPayload();
    if (editingSurveyId) {
      const updatePayload: UpdateSurveyRequest = {
        ...payload,
        conditionalLogic: conditionalLogic
      };
      updateSurvey.mutate(
        { id: editingSurveyId, payload: updatePayload },
        {
          onSuccess: (updated) => {
            setSelectedSurveyId(updated.id);
            resetCreateForm();
            setCreateFeedback({ type: "success", message: "Sondaj actualizat." });
            setTab("manage");
          },
          onError: (error) => {
            setCreateFeedback({ type: "error", message: mutationErrorMessage(error) });
          }
        }
      );
      return;
    }
    createSurvey.mutate(payload, {
      onSuccess: (created) => {
        setSelectedSurveyId(created.id);
        resetCreateForm();
        setCreateFeedback({ type: "success", message: "Sondaj salvat. Poți continua din listă sau gestionare." });
        setTab("list");
      },
      onError: (error) => {
        setCreateFeedback({ type: "error", message: mutationErrorMessage(error) });
      }
    });
  };

  const openSurveyForRespond = useCallback(
    async (surveyId: string) => {
      const survey = surveys.find((item) => item.id === surveyId);
      if (!survey) {
        setListFeedback("Selectați un sondaj din listă.");
        return;
      }
      if (respondedSurveyIds.has(surveyId)) {
        setListFeedback("Ați completat deja acest sondaj.");
        return;
      }
      if (survey.status === "CLOSED" || survey.status === "ARCHIVED") {
        setListFeedback("Sondajul este închis sau arhivat și nu mai poate fi completat.");
        return;
      }
      setListFeedback(null);
      setOpeningSurveyId(surveyId);
      try {
        if (survey.status === "DRAFT") {
          await activateSurvey.mutateAsync(surveyId);
        }
        navigate(`/surveys/respond/${surveyId}`);
      } catch (error) {
        setListFeedback(mutationErrorMessage(error));
      } finally {
        setOpeningSurveyId(null);
      }
    },
    [surveys, respondedSurveyIds, activateSurvey, navigate]
  );

  const generatePublicLink = () => {
    if (!selectedSurveyId || !publicExpiresAt) {
      setPublicLinkError("Completează data de expirare pentru linkul public.");
      return;
    }
    setPublicLinkError(null);
    createPublicLink.mutate(
      {
        id: selectedSurveyId,
        payload: {
          expiresAt: publicExpiresAt,
          responseLimit: publicResponseLimit ? Number(publicResponseLimit) : undefined
        }
      },
      {
        onError: (error) => setPublicLinkError(mutationErrorMessage(error))
      }
    );
  };

  const download = async (type: "json" | "xlsx" | "pdf") => {
    if (!selectedSurveyId) return;
    setDownloadError(null);
    try {
      await downloadWithAuth(
        surveysApi.getExportUrl(selectedSurveyId, type),
        `survey-${selectedSurveyId}.${type === "xlsx" ? "xls" : type}`
      );
    } catch (error) {
      setDownloadError(mutationErrorMessage(error));
    }
  };

  const publicLinkUrl =
    createPublicLink.isSuccess && createPublicLink.data
      ? typeof window !== "undefined"
        ? `${window.location.origin}${createPublicLink.data.url}`
        : createPublicLink.data.url
      : undefined;

  const tabs: Array<{ id: SurveyTab; label: string }> = [
    { id: "list", label: "Lista sondaje" },
    { id: "create", label: editingSurveyId ? "Editează sondaj" : "Sondaj nou" },
    { id: "manage", label: selectedSurvey ? `Gestionează: ${selectedSurvey.title.slice(0, 24)}${selectedSurvey.title.length > 24 ? "…" : ""}` : "Gestionează" }
  ];

  return (
    <div className="comms-page surveys-page">
      <header className="comms-header">
        <div>
          <h1 className="page-title">Sondaje</h1>
          <p className="page-lead">Creează chestionare, distribuie linkuri și analizează răspunsurile.</p>
        </div>
      </header>

      <div className="comms-kpi" aria-label="Indicatori sondaje">
        <div>
          <span>Active</span>
          <strong>{kpi?.activeSurveys ?? "—"}</strong>
        </div>
        <div>
          <span>Răspunsuri</span>
          <strong>{kpi?.totalResponses ?? "—"}</strong>
        </div>
        <div>
          <span>Linkuri publice</span>
          <strong>{kpi?.publicLinks ?? "—"}</strong>
        </div>
      </div>

      <nav className="comms-tabs" aria-label="Secțiuni sondaje">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`comms-tab${tab === item.id ? " active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "list" ? (
        <SurveyListPanel
          items={filteredSurveys}
          total={surveysPaged.total}
          page={surveysPaged.page}
          pageSize={surveysPaged.pageSize}
          totalPages={surveysPaged.totalPages}
          isLoading={surveysQuery.isLoading}
          isFetching={surveysQuery.isFetching}
          search={search}
          statusFilter={statusFilter}
          selectedId={selectedSurveyId}
          canComplete={canComplete}
          respondedIds={respondedSurveyIds}
          openingSurveyId={openingSurveyId}
          feedback={listFeedback}
          onSearchChange={setSearch}
          onStatusFilterChange={setStatusFilter}
          onPageChange={surveysPage.setPage}
          onPageSizeChange={surveysPage.setPageSize}
          onSelect={setSelectedSurveyId}
          onManage={openManage}
          onCreateClick={openCreate}
          onComplete={(id) => void openSurveyForRespond(id)}
        />
      ) : null}

      {tab === "create" ? (
        <SurveyCreateForm
          mode={editingSurveyId ? "edit" : "create"}
          surveyForm={surveyForm}
          questionForm={questionForm}
          questions={questions}
          conditionalLogic={conditionalLogic}
          audienceOptions={audienceOptions}
          canSave={canSaveSurvey}
          isPending={createSurvey.isPending || updateSurvey.isPending}
          feedback={createFeedback}
          onSurveyChange={(patch) => setSurveyForm((prev) => ({ ...prev, ...patch }))}
          onQuestionChange={(patch) => setQuestionForm((prev) => ({ ...prev, ...patch }))}
          onAudienceRefChange={onAudienceRefChange}
          onAddQuestion={addQuestion}
          onUpdateOption={(index, label) =>
            setQuestionForm((prev) => ({
              ...prev,
              options: prev.options.map((option, optionIndex) =>
                optionIndex === index ? { ...option, value: label, label } : option
              )
            }))
          }
          onUpdateOptionImageUrl={(index, imageUrl) =>
            setQuestionForm((prev) => ({
              ...prev,
              options: prev.options.map((option, optionIndex) =>
                optionIndex === index ? { ...option, imageUrl } : option
              )
            }))
          }
          onAddOption={() => setQuestionForm((prev) => ({ ...prev, options: [...prev.options, { value: "", label: "" }] }))}
          onRemoveOption={(index) =>
            setQuestionForm((prev) => ({ ...prev, options: prev.options.filter((_, optionIndex) => optionIndex !== index) }))
          }
          onConditionalLogicChange={setConditionalLogic}
          onSubmit={onSurveySubmit}
          onCancel={() => {
            resetCreateForm();
            setTab("list");
          }}
        />
      ) : null}

      {tab === "manage" ? (
        <SurveyManagePanel
          survey={selectedSurvey}
          stats={statsQuery.data?.questionStats}
          statsLoading={statsQuery.isLoading}
          canComplete={canComplete}
          responded={selectedSurvey ? respondedSurveyIds.has(selectedSurvey.id) : false}
          openingSurveyId={openingSurveyId}
          publicExpiresAt={publicExpiresAt}
          publicResponseLimit={publicResponseLimit}
          activatePending={activateSurvey.isPending}
          closePending={closeSurvey.isPending}
          publicLinkPending={createPublicLink.isPending}
          publicLinkUrl={publicLinkUrl}
          publicLinkError={publicLinkError}
          downloadError={downloadError}
          onComplete={() => selectedSurvey && void openSurveyForRespond(selectedSurvey.id)}
          onActivate={() => selectedSurveyId && activateSurvey.mutate(selectedSurveyId)}
          onClose={() => selectedSurveyId && closeSurvey.mutate(selectedSurveyId)}
          onPublicExpiresChange={setPublicExpiresAt}
          onPublicLimitChange={setPublicResponseLimit}
          onGeneratePublicLink={generatePublicLink}
          onDownload={(type) => void download(type)}
          onBackToList={() => setTab("list")}
          onEdit={selectedSurvey ? () => openEdit(selectedSurvey) : undefined}
        />
      ) : null}
    </div>
  );
}
