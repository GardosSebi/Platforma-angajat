import type {
  AssignTrainingRequest,
  AssignTrainingResponse,
  CompleteSsmTestRequest,
  CloseSsmAccidentCaseRequest,
  CreateSsmAccidentCaseRequest,
  CreateSsmAccidentCorrectiveMeasureRequest,
  CreateSsmAccidentTaskRequest,
  CreateSsmEipMovementRequest,
  CreateSsmEipNormRequest,
  CreateSsmEipTypeRequest,
  CreateSsmMedicalControlRequest,
  CreateSsmMedicalControlTypeRequest,
  UpdateSsmMedicalControlRequest,
  CreateSsmPsiEquipmentRequest,
  CreateSsmPsiResponsibleRequest,
  CreateSsmPsiTrainingRecordRequest,
  CreateSsmRiskAssessmentRequest,
  RegisterSsmPsiEquipmentVerificationRequest,
  CreateSsmTrainingPlanGroupRequest,
  CreateSsmTrainingPlanGroupResponse,
  CreateSsmTrainingPlanRequest,
  CreateSsmTrainingTypeRequest,
  CreateSsmDocumentRequest,
  AddSsmRiskAssessmentVersionRequest,
  SsmComplianceEmployee,
  SsmEipDueNotification,
  SsmEipMovementItem,
  SsmEipNormItem,
  SsmEipStockGapItem,
  SsmEipTypeItem,
  SsmMedicalControlItem,
  SsmMedicalControlTypeItem,
  SsmMedicalReminderItem,
  SsmPsiEquipmentItem,
  SsmPsiEquipmentNotification,
  SsmPsiResponsibleItem,
  SsmPsiTrainingRecordItem,
  SsmPsiWorksiteDocumentation,
  SsmRiskAssessmentHistoryResponse,
  SsmRiskAssessmentItem,
  SsmComplianceDashboardResponse,
  SsmReportResponse,
  SsmReportType,
  SsmUnifiedCalendarResponse,
  SsmAccidentCaseItem,
  SsmAccidentStats,
  SsmReminderItem,
  SsmDocumentControlFoldersResponse,
  SsmDocumentHistoryResponse,
  SsmDocumentListItem,
  ListSsmDocumentTemplatesResponse,
  SsmTrainingPlanItem,
  SignSsmTrainingBatchRequest,
  SsmTrainingTypeItem,
  UploadSsmDocumentResponse
} from "@repo/shared-types/ssm";
import type {
  CreateSsmScheduledReportRequest,
  SsmScheduledReportRow,
  UpdateSsmScheduledReportRequest
} from "@repo/shared-types/ssm-scheduled-reports";
import type { PaginatedResult, PaginationParams } from "@repo/shared-types/pagination";
import { buildPaginationQuery } from "../../../shared/api/pagination-query";
import { httpClient } from "../../../shared/api/http-client";

export const ssmApi = {
  assignTraining(payload: AssignTrainingRequest) {
    return httpClient<AssignTrainingResponse>("/ssm/trainings/assign", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  listDocuments(query: URLSearchParams) {
    const q = query.toString();
    return httpClient<PaginatedResult<SsmDocumentListItem>>(`/ssm/documents${q ? `?${q}` : ""}`);
  },
  getDocumentHistory(documentId: string) {
    return httpClient<SsmDocumentHistoryResponse>(`/ssm/documents/${documentId}/history`);
  },
  getControlFolders() {
    return httpClient<SsmDocumentControlFoldersResponse>("/ssm/documents/control/quick-access");
  },
  listDocumentTemplates() {
    return httpClient<ListSsmDocumentTemplatesResponse>("/ssm/documents/templates");
  },
  seedDocumentTemplates() {
    return httpClient<{ created: number }>("/ssm/documents/templates/seed-defaults", { method: "POST" });
  },
  createDocument(payload: CreateSsmDocumentRequest, file: File) {
    const body = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      body.append(key, String(value));
    });
    body.append("file", file);
    return httpClient<UploadSsmDocumentResponse>("/ssm/documents", {
      method: "POST",
      body
    });
  },
  addVersion(documentId: string, file: File, changeNote?: string) {
    const body = new FormData();
    if (changeNote?.trim()) {
      body.append("changeNote", changeNote.trim());
    }
    body.append("file", file);
    return httpClient<UploadSsmDocumentResponse>(`/ssm/documents/${documentId}/versions`, {
      method: "POST",
      body
    });
  },
  revertVersion(documentId: string, versionId: string, changeNote?: string) {
    return httpClient<{ activeVersionNumber: number }>(`/ssm/documents/${documentId}/revert`, {
      method: "PATCH",
      body: JSON.stringify({ versionId, changeNote })
    });
  },
  archiveDocument(documentId: string) {
    return httpClient<{ status: "ARCHIVED" }>(`/ssm/documents/${documentId}/archive`, {
      method: "PATCH"
    });
  },
  listTrainingTypes() {
    return httpClient<SsmTrainingTypeItem[]>("/ssm/training-suite/types");
  },
  createTrainingType(payload: CreateSsmTrainingTypeRequest) {
    return httpClient<SsmTrainingTypeItem>("/ssm/training-suite/types", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  listTrainingPlans(params?: PaginationParams) {
    return httpClient<PaginatedResult<SsmTrainingPlanItem>>(
      `/ssm/training-suite/plans${buildPaginationQuery(params)}`
    );
  },
  createTrainingPlan(payload: CreateSsmTrainingPlanRequest) {
    return httpClient<{ id: string }>("/ssm/training-suite/plans", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  createTrainingPlanGroup(payload: CreateSsmTrainingPlanGroupRequest) {
    return httpClient<CreateSsmTrainingPlanGroupResponse>("/ssm/training-suite/plans/group", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  markMaterialCompleted(trainingPlanId: string, durationSeconds?: number) {
    return httpClient<{ materialCompleted: boolean }>(`/ssm/training-suite/plans/${trainingPlanId}/material-complete`, {
      method: "PATCH",
      body: JSON.stringify(durationSeconds != null ? { durationSeconds } : {})
    });
  },
  startMaterial(trainingPlanId: string) {
    return httpClient<{ materialStartedAt: string | null; materialTimeSpentSeconds: number }>(
      `/ssm/training-suite/plans/${trainingPlanId}/material-start`,
      { method: "PATCH" }
    );
  },
  startTest(trainingPlanId: string) {
    return httpClient<import("@repo/shared-types/ssm-training-test").StartSsmTrainingTestResponse>(
      `/ssm/training-suite/tests/start/${trainingPlanId}`,
      {
        method: "POST"
      }
    );
  },
  completeTest(payload: CompleteSsmTestRequest) {
    return httpClient<{
      passed: boolean;
      score: number;
      correctCount: number;
      totalCount: number;
      passThresholdPercent: number;
    }>("/ssm/training-suite/tests/complete", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  signPlan(trainingPlanId: string, role: "EMPLOYEE" | "MANAGER" | "RESPONSIBLE", signatureData: string) {
    return httpClient(`/ssm/training-suite/plans/${trainingPlanId}/sign`, {
      method: "PATCH",
      body: JSON.stringify({ role, signatureData })
    });
  },
  signPlansBatch(payload: SignSsmTrainingBatchRequest) {
    return httpClient<{ requested: number; signed: number; skipped: number }>("/ssm/training-suite/plans/sign-batch", {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  listReminders() {
    return httpClient<{ reminders: SsmReminderItem[] }>("/ssm/training-suite/reminders");
  },
  dispatchTrainingReminders() {
    return httpClient<{ sent: number }>("/ssm/training-suite/reminders/dispatch", {
      method: "POST"
    });
  },
  listTrainingCalendar() {
    return httpClient<{ events: import("@repo/shared-types/ssm").SsmTrainingCalendarEvent[] }>(
      "/ssm/training-suite/calendar"
    );
  },
  complianceReport() {
    return httpClient<import("@repo/shared-types/ssm").SsmTrainingComplianceReport>("/ssm/training-suite/compliance");
  },
  employeeDigitalFile(employeeId: string) {
    return httpClient<{
      trainings: Array<{ id: string; type: string; dueAt: string; status: string; score?: number | null }>;
      documents: Array<{ id: string; title: string; type: string; fileName?: string }>;
      riskExposureSheets?: Array<{ id: string; title: string; fileName?: string }>;
      eipDecisionCopies?: Array<{ id: string; title: string; fileName?: string }>;
      medicalControls?: Array<{
        id: string;
        controlType: string;
        scheduledAt: string;
        performedAt?: string | null;
        nextDueAt?: string | null;
        result?: string | null;
        aptitudeSheetName?: string | null;
        hasAptitudeSheet?: boolean;
      }>;
    }>(`/ssm/training-suite/employees/${employeeId}/digital-file`);
  },
  getMedicalAptitudeSheetUrl(controlId: string) {
    return `/ssm/medical/controls/${controlId}/aptitude-sheet`;
  },
  getIndividualSheetUrl(trainingPlanId: string) {
    return `/ssm/training-suite/plans/${trainingPlanId}/individual-sheet.pdf`;
  },
  getCollectiveSheetUrl() {
    return `/ssm/training-suite/collective-sheet.pdf`;
  },
  getDigitalFileZipUrl(employeeId: string) {
    return `/ssm/training-suite/employees/${employeeId}/digital-file.zip`;
  },
  listEipTypes() {
    return httpClient<SsmEipTypeItem[]>("/ssm/eip/types");
  },
  createEipType(payload: CreateSsmEipTypeRequest) {
    return httpClient<SsmEipTypeItem>("/ssm/eip/types", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  listEipNorms() {
    return httpClient<{ items: SsmEipNormItem[] }>("/ssm/eip/norms");
  },
  upsertEipNorm(payload: CreateSsmEipNormRequest) {
    return httpClient("/ssm/eip/norms", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  registerEipMovement(payload: CreateSsmEipMovementRequest) {
    return httpClient("/ssm/eip/movements", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  eipRegister() {
    return httpClient<{ items: SsmEipMovementItem[] }>("/ssm/eip/register");
  },
  eipNotifications() {
    return httpClient<{ reminders: SsmEipDueNotification[] }>("/ssm/eip/notifications");
  },
  dispatchEipNotifications() {
    return httpClient<{
      candidates: number;
      sent: number;
      sentEmail: number;
      sentInApp: number;
      sentResponsible: number;
    }>("/ssm/eip/notifications/dispatch", { method: "POST" });
  },
  eipStockGapReport() {
    return httpClient<{ items: SsmEipStockGapItem[] }>("/ssm/eip/reports/stock-gap");
  },
  getEipRegisterPdfUrl() {
    return "/ssm/eip/register.pdf";
  },
  listAccidentCases(params?: PaginationParams) {
    return httpClient<PaginatedResult<SsmAccidentCaseItem>>(`/ssm/accidents${buildPaginationQuery(params)}`);
  },
  createAccidentCase(payload: CreateSsmAccidentCaseRequest) {
    return httpClient<{ id: string }>("/ssm/accidents", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  addAccidentTask(payload: CreateSsmAccidentTaskRequest) {
    return httpClient<{ id: string }>("/ssm/accidents/tasks", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  completeAccidentTask(taskId: string) {
    return httpClient<{ completed: boolean }>(`/ssm/accidents/tasks/${taskId}/complete`, {
      method: "PATCH"
    });
  },
  addAccidentCorrectiveMeasure(payload: CreateSsmAccidentCorrectiveMeasureRequest) {
    return httpClient<{ id: string }>("/ssm/accidents/measures", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  completeAccidentCorrectiveMeasure(measureId: string) {
    return httpClient<{ completed: boolean }>(`/ssm/accidents/measures/${measureId}/complete`, {
      method: "PATCH"
    });
  },
  closeAccidentCase(caseId: string, payload: CloseSsmAccidentCaseRequest) {
    return httpClient<{ id: string }>(`/ssm/accidents/${caseId}/close`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  accidentStats(params?: { from?: string; to?: string }) {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const qs = query.toString();
    return httpClient<SsmAccidentStats>(`/ssm/accidents/stats/overview${qs ? `?${qs}` : ""}`);
  },
  getAccidentReportUrl(caseId: string) {
    return `/ssm/accidents/${caseId}/report.pdf`;
  },
  listMedicalControlTypes() {
    return httpClient<SsmMedicalControlTypeItem[]>("/ssm/medical/control-types");
  },
  createMedicalControlType(payload: CreateSsmMedicalControlTypeRequest) {
    return httpClient<SsmMedicalControlTypeItem>("/ssm/medical/control-types", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  listMedicalControls() {
    return httpClient<{ items: SsmMedicalControlItem[] }>("/ssm/medical/controls");
  },
  createMedicalControl(payload: CreateSsmMedicalControlRequest, aptitudeSheet?: File) {
    const body = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      body.append(key, String(value));
    });
    if (aptitudeSheet) {
      body.append("aptitudeSheet", aptitudeSheet);
    }
    return httpClient<{ id: string }>("/ssm/medical/controls", {
      method: "POST",
      body
    });
  },
  updateMedicalControl(controlId: string, payload: UpdateSsmMedicalControlRequest, aptitudeSheet?: File) {
    const body = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      body.append(key, String(value));
    });
    if (aptitudeSheet) {
      body.append("aptitudeSheet", aptitudeSheet);
    }
    return httpClient<{ id: string }>(`/ssm/medical/controls/${controlId}`, {
      method: "PATCH",
      body
    });
  },
  medicalReminders() {
    return httpClient<{ reminders: SsmMedicalReminderItem[] }>("/ssm/medical/reminders");
  },
  listRiskAssessments(query?: URLSearchParams) {
    const q = query?.toString();
    return httpClient<{ items: SsmRiskAssessmentItem[] }>(`/ssm/risk-assessments${q ? `?${q}` : ""}`);
  },
  createRiskAssessment(payload: CreateSsmRiskAssessmentRequest) {
    return httpClient<{ assessmentId: string; versionId: string; versionNumber: number }>("/ssm/risk-assessments", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  addRiskAssessmentVersion(assessmentId: string, payload: AddSsmRiskAssessmentVersionRequest) {
    return httpClient<{ assessmentId: string; versionId: string; versionNumber: number }>(
      `/ssm/risk-assessments/${assessmentId}/versions`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );
  },
  getRiskAssessmentHistory(assessmentId: string) {
    return httpClient<SsmRiskAssessmentHistoryResponse>(`/ssm/risk-assessments/${assessmentId}/history`);
  },
  archiveRiskAssessment(assessmentId: string) {
    return httpClient<{ status: "ARCHIVED" }>(`/ssm/risk-assessments/${assessmentId}/archive`, {
      method: "PATCH"
    });
  },
  psiDocumentation() {
    return httpClient<{ worksites: SsmPsiWorksiteDocumentation[] }>("/ssm/psi/documentation");
  },
  psiEquipment() {
    return httpClient<{ items: SsmPsiEquipmentItem[] }>("/ssm/psi/equipment");
  },
  createPsiEquipment(payload: CreateSsmPsiEquipmentRequest) {
    return httpClient<SsmPsiEquipmentItem>("/ssm/psi/equipment", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  registerPsiEquipmentVerification(payload: RegisterSsmPsiEquipmentVerificationRequest) {
    return httpClient("/ssm/psi/equipment/verifications", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  psiEquipmentNotifications() {
    return httpClient<{ reminders: SsmPsiEquipmentNotification[] }>("/ssm/psi/equipment/notifications");
  },
  psiTrainings() {
    return httpClient<{ items: SsmPsiTrainingRecordItem[] }>("/ssm/psi/trainings");
  },
  createPsiTraining(payload: CreateSsmPsiTrainingRecordRequest) {
    return httpClient<SsmPsiTrainingRecordItem>("/ssm/psi/trainings", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  psiResponsibles() {
    return httpClient<{ items: SsmPsiResponsibleItem[] }>("/ssm/psi/responsibles");
  },
  createPsiResponsible(payload: CreateSsmPsiResponsibleRequest) {
    return httpClient<SsmPsiResponsibleItem>("/ssm/psi/responsibles", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  unifiedCalendar() {
    return httpClient<SsmUnifiedCalendarResponse>("/ssm/overview/calendar");
  },
  complianceDashboard() {
    return httpClient<SsmComplianceDashboardResponse>("/ssm/overview/compliance-dashboard");
  },
  ssmReport(type: SsmReportType) {
    return httpClient<SsmReportResponse>(`/ssm/reports/${type}`);
  },
  getSsmReportPdfUrl(type: SsmReportType) {
    return `/ssm/reports/${type}.pdf`;
  },
  getSsmReportExcelUrl(type: SsmReportType) {
    return `/ssm/reports/${type}.xlsx`;
  },
  listPreventionPlans() {
    return httpClient<{ items: import("@repo/shared-types/ssm").SsmPreventionPlanItem[] }>("/ssm/prevention-plans");
  },
  createPreventionPlan(payload: import("@repo/shared-types/ssm").CreateSsmPreventionPlanRequest) {
    return httpClient<{ planId: string }>("/ssm/prevention-plans", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  archivePreventionPlan(planId: string) {
    return httpClient<{ archived: boolean }>(`/ssm/prevention-plans/${planId}/archive`, { method: "PATCH" });
  },
  createPreventionMeasure(payload: import("@repo/shared-types/ssm").CreateSsmPreventionMeasureRequest) {
    return httpClient<{ measureId: string }>("/ssm/prevention-measures", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updatePreventionMeasure(measureId: string, payload: import("@repo/shared-types/ssm").UpdateSsmPreventionMeasureRequest) {
    return httpClient(`/ssm/prevention-measures/${measureId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  listEvacuationDrills() {
    return httpClient<{ items: import("@repo/shared-types/ssm").SsmEvacuationDrillItem[] }>("/ssm/evacuation-drills");
  },
  createEvacuationDrill(payload: import("@repo/shared-types/ssm").CreateSsmEvacuationDrillRequest) {
    return httpClient<{ drillId: string }>("/ssm/evacuation-drills", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getCalendarPdfUrl() {
    return "/ssm/overview/calendar.pdf";
  },
  listScheduledReports() {
    return httpClient<SsmScheduledReportRow[]>("/ssm/scheduled-reports");
  },
  createScheduledReport(payload: CreateSsmScheduledReportRequest) {
    return httpClient<SsmScheduledReportRow>("/ssm/scheduled-reports", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateScheduledReport(id: string, payload: UpdateSsmScheduledReportRequest) {
    return httpClient<SsmScheduledReportRow>(`/ssm/scheduled-reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  deleteScheduledReport(id: string) {
    return httpClient<{ deleted: boolean }>(`/ssm/scheduled-reports/${id}`, {
      method: "DELETE"
    });
  }
};
