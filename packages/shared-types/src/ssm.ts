export interface AssignTrainingRequest {
  employeeId: string;
  trainingCode: string;
  dueDate: string;
}

export interface AssignTrainingResponse {
  assignmentId: string;
}

export const SSM_DOCUMENT_TYPES = [
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
] as const;

export type SsmDocumentType = (typeof SSM_DOCUMENT_TYPES)[number];

export const SSM_DOCUMENT_TARGET_TYPES = [
  "JOB_POSITION",
  "DEPARTMENT",
  "WORKSITE",
  "ENTITY",
  "ALL"
] as const;

export type SsmDocumentTargetType = (typeof SSM_DOCUMENT_TARGET_TYPES)[number];

export type SsmDocumentStatus = "ACTIVE" | "ARCHIVED";

export interface CreateSsmDocumentRequest {
  title: string;
  type: SsmDocumentType;
  entityName?: string;
  departmentName?: string;
  jobPositionName?: string;
  periodStart?: string;
  periodEnd?: string;
  targetType: SsmDocumentTargetType;
  targetRefId?: string;
  targetLabel?: string;
  isControlFolder?: boolean;
  changeNote?: string;
}

export interface SsmDocumentVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdBy: string;
  createdAt: string;
  changeNote?: string | null;
}

export interface SsmDocumentListItem {
  id: string;
  title: string;
  type: SsmDocumentType;
  status: SsmDocumentStatus;
  entityName?: string | null;
  departmentName?: string | null;
  jobPositionName?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  targetType: SsmDocumentTargetType;
  targetRefId?: string | null;
  targetLabel?: string | null;
  isControlFolder: boolean;
  createdAt: string;
  updatedAt: string;
  activeVersion: SsmDocumentVersion;
}

export interface ListSsmDocumentsResponse {
  items: SsmDocumentListItem[];
}

export interface SsmDocumentHistoryResponse {
  documentId: string;
  title: string;
  activeVersionId?: string | null;
  versions: SsmDocumentVersion[];
}

export interface SsmDocumentControlFoldersResponse {
  folders: Array<{
    key: string;
    label: string;
    count: number;
    documents: SsmDocumentListItem[];
  }>;
}

export interface SsmDocumentTemplateItem {
  id: string;
  name: string;
  title: string;
  type: SsmDocumentType;
  targetType: SsmDocumentTargetType;
  targetLabel?: string | null;
  isControlFolder: boolean;
  checklistItems: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSsmDocumentTemplateRequest {
  name: string;
  title: string;
  type: SsmDocumentType;
  targetType?: SsmDocumentTargetType;
  targetLabel?: string;
  isControlFolder?: boolean;
  checklistItems?: string[];
  active?: boolean;
}

export interface ListSsmDocumentTemplatesResponse {
  items: SsmDocumentTemplateItem[];
}

export interface UploadSsmDocumentResponse {
  documentId: string;
  versionId: string;
  versionNumber: number;
}

export interface CreateSsmTrainingTypeRequest {
  code: string;
  name: string;
  category?: SsmTrainingCategory;
  legalMinDurationHours?: number;
  description?: string;
  recurrenceDays?: number;
  reminderDays?: number[];
}

export type SsmTrainingCategory =
  | "INTRODUCTORY_GENERAL"
  | "WORKPLACE"
  | "PERIODIC"
  | "SUPPLEMENTARY"
  | "EMERGENCY_PSI";

export interface SsmTrainingTypeItem {
  id: string;
  code: string;
  name: string;
  category: SsmTrainingCategory;
  legalMinDurationHours?: number | null;
  description?: string | null;
  recurrenceDays?: number | null;
  reminderDays: number[];
  active: boolean;
}

export type SsmTrainingPlanStatus = "PENDING" | "COMPLETED" | "OVERDUE" | "BLOCKED";

export interface CreateSsmTrainingPlanRequest {
  employeeId: string;
  trainingTypeId: string;
  scheduledAt: string;
  dueAt: string;
  materialTitle?: string;
  materialUrl?: string;
}

export interface CreateSsmTrainingPlanGroupRequest {
  employeeGroupId: string;
  trainingTypeId: string;
  scheduledAt: string;
  dueAt: string;
  materialTitle?: string;
  materialUrl?: string;
}

export interface CreateSsmTrainingPlanGroupResponse {
  groupId: string;
  groupName: string;
  createdCount: number;
  planIds: string[];
}

export interface CompleteSsmTestRequest {
  trainingPlanId: string;
  /** Map questionId → selected option index (0-based, în ordinea afișată). */
  answers: Record<string, number>;
  durationSeconds: number;
}

export interface SignSsmTrainingPlanRequest {
  role: "EMPLOYEE" | "MANAGER" | "RESPONSIBLE";
  signatureData: string;
}

export interface SignSsmTrainingBatchRequest {
  planIds: string[];
  role: "EMPLOYEE" | "MANAGER" | "RESPONSIBLE";
  signatureData: string;
}

export interface SsmTrainingPlanItem {
  id: string;
  employeeId: string;
  trainingTypeId: string;
  trainingTypeCode: string;
  trainingTypeName: string;
  trainingTypeCategory?: SsmTrainingCategory;
  employeeName: string;
  scheduledAt: string;
  dueAt: string;
  completedAt?: string | null;
  materialTitle?: string | null;
  materialUrl?: string | null;
  materialStartedAt?: string | null;
  materialCompletedAt?: string | null;
  materialTimeSpentSeconds?: number | null;
  score?: number | null;
  durationMinutes?: number | null;
  status: SsmTrainingPlanStatus;
  blockedAdmission: boolean;
  employeeSignedAt?: string | null;
  managerSignedAt?: string | null;
  responsibleSignedAt?: string | null;
}

export interface SsmTrainingCalendarEvent {
  id: string;
  title: string;
  scheduledAt: string;
  dueAt: string;
  status: SsmTrainingPlanStatus;
  employeeName?: string;
  trainingTypeName?: string;
}

export interface SsmComplianceDepartment {
  departmentId: string | null;
  departmentName: string;
  employeeCount: number;
  compliantCount: number;
  complianceScore: number;
  blockedCount: number;
}

export interface SsmTrainingComplianceReport {
  items: SsmComplianceEmployee[];
  byDepartment: SsmComplianceDepartment[];
  summary: {
    employeeCount: number;
    compliantPercent: number;
    blockedAdmissionCount: number;
  };
}

export interface SsmReminderItem {
  trainingPlanId: string;
  employeeName: string;
  trainingTypeName: string;
  dueAt: string;
  daysUntilDue: number;
}

export interface SsmComplianceEmployee {
  employeeId: string;
  employeeName: string;
  completed: number;
  pending: number;
  overdue: number;
  complianceScore: number;
  blockedAdmission: boolean;
}

export type SsmEipMovementType = "INTAKE" | "DISTRIBUTION" | "RETURN" | "SCRAP";

export interface CreateSsmEipTypeRequest {
  code: string;
  name: string;
  defaultLifetimeDays?: number;
}

export interface CreateSsmEipNormRequest {
  jobPositionId: string;
  eipTypeId: string;
  requiredQuantity: number;
  lifetimeDays: number;
  replacementRule?: string;
}

export interface CreateSsmEipMovementRequest {
  employeeId?: string;
  eipTypeId: string;
  worksiteId?: string;
  departmentId?: string;
  movementType: SsmEipMovementType;
  quantity: number;
  replacementDueAt?: string;
  notes?: string;
  signatureData?: string;
}

export interface SsmEipTypeItem {
  id: string;
  code: string;
  name: string;
  defaultLifetimeDays?: number | null;
  active: boolean;
}

export interface SsmEipNormItem {
  id: string;
  jobPositionId: string;
  jobPositionName: string;
  eipTypeId: string;
  eipTypeName: string;
  requiredQuantity: number;
  lifetimeDays: number;
  replacementRule?: string | null;
}

export interface SsmEipMovementItem {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  eipTypeId: string;
  eipTypeName: string;
  worksiteId?: string | null;
  worksiteName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  movementType: SsmEipMovementType;
  quantity: number;
  movementDate: string;
  replacementDueAt?: string | null;
  signedAt?: string | null;
  notes?: string | null;
}

export interface SsmEipDueNotification {
  movementId: string;
  employeeName: string;
  eipTypeName: string;
  replacementDueAt: string;
  daysUntilDue: number;
  worksiteName?: string | null;
}

export interface SsmEipStockGapItem {
  eipTypeId: string;
  eipTypeName: string;
  worksiteId?: string | null;
  worksiteName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  scopeKey: string;
  required: number;
  distributedActive: number;
  stockOnHand: number;
  shortage: number;
}

export type SsmAccidentType = "ACCIDENT" | "INCIDENT" | "OCCUPATIONAL_DISEASE";
export type SsmAccidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SsmAccidentCaseStatus = "OPEN" | "IN_RESEARCH" | "MEASURES_DEFINED" | "CLOSED";

export interface CreateSsmAccidentCaseRequest {
  employeeId?: string;
  worksiteId?: string;
  departmentId?: string;
  type: SsmAccidentType;
  severity: SsmAccidentSeverity;
  title: string;
  occurredAt: string;
  location?: string;
  description: string;
  witnesses?: string[];
  contributingFactors?: string;
  immediateMeasures?: string;
  itmDaysOff?: number;
  hasPermanentDisability?: boolean;
  isFatality?: boolean;
  diseaseConfirmed?: boolean;
  diseaseConfirmedAt?: string;
  diseaseConfirmedBy?: string;
  diseaseDocumentRef?: string;
  researchResponsible?: string;
  legalDaysDeadline?: number;
}

export interface CreateSsmAccidentTaskRequest {
  accidentCaseId: string;
  title: string;
  assignedTo?: string;
  dueAt: string;
  notes?: string;
}

export interface CreateSsmAccidentCorrectiveMeasureRequest {
  accidentCaseId: string;
  description: string;
  assignedTo?: string;
  dueAt: string;
}

export interface CloseSsmAccidentCaseRequest {
  conclusions: string;
  correctiveMeasures?: string;
}

export interface SsmAccidentTaskItem {
  id: string;
  title: string;
  assignedTo?: string | null;
  dueAt: string;
  completedAt?: string | null;
  notes?: string | null;
}

export interface SsmAccidentCorrectiveMeasureItem {
  id: string;
  description: string;
  assignedTo?: string | null;
  dueAt: string;
  completedAt?: string | null;
}

export interface SsmAccidentCaseItem {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  worksiteId?: string | null;
  worksiteName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  type: SsmAccidentType;
  severity: SsmAccidentSeverity;
  status: SsmAccidentCaseStatus;
  title: string;
  occurredAt: string;
  dueAt: string;
  location?: string | null;
  description?: string;
  witnesses?: string[];
  contributingFactors?: string | null;
  immediateMeasures?: string | null;
  itmDaysOff?: number | null;
  hasPermanentDisability?: boolean;
  isFatality?: boolean;
  diseaseConfirmed?: boolean;
  diseaseConfirmedAt?: string | null;
  diseaseConfirmedBy?: string | null;
  diseaseDocumentRef?: string | null;
  researchResponsible?: string | null;
  conclusions?: string | null;
  correctiveMeasures?: string | null;
  tasks: SsmAccidentTaskItem[];
  correctiveMeasureItems: SsmAccidentCorrectiveMeasureItem[];
}

export interface SsmAccidentStatsBucket {
  key: string;
  label: string;
  count: number;
}

export interface SsmAccidentStats {
  byType: Record<SsmAccidentType, number>;
  bySeverity: Record<SsmAccidentSeverity, number>;
  byDepartment: SsmAccidentStatsBucket[];
  byWorksite: SsmAccidentStatsBucket[];
  openCases: number;
  overdueTasks: number;
  overdueMeasures: number;
  totalCases: number;
  accidentCount: number;
  totalItmDaysOff: number;
  activeEmployees: number;
  /** Indice frecvență simplificat: accidente × 1000 / angajați activi */
  frequencyRate: number | null;
  /** Indice gravitate simplificat: zile ITM / accidente de muncă */
  severityRate: number | null;
  periodFrom?: string | null;
  periodTo?: string | null;
}

export type SsmMedicalControlResult = "FIT" | "FIT_CONDITIONAL" | "TEMPORARY_UNFIT" | "UNFIT";
export type SsmMedicalControlCategory = "HIRE" | "PERIODIC" | "RESUME" | "JOB_CHANGE";

export interface CreateSsmMedicalControlTypeRequest {
  code: string;
  name: string;
  jobPositionId: string;
  category: SsmMedicalControlCategory;
  recurrenceDays?: number;
  reminderDays?: number[];
}

export interface SsmMedicalControlTypeItem {
  id: string;
  code: string;
  name: string;
  category: SsmMedicalControlCategory;
  jobPositionId: string;
  jobPositionName?: string | null;
  recurrenceDays?: number | null;
  reminderDays: number[];
  active: boolean;
}

export interface CreateSsmMedicalControlRequest {
  employeeId: string;
  controlTypeId: string;
  scheduledAt: string;
  performedAt?: string;
  result?: SsmMedicalControlResult;
  recommendations?: string;
  validityUntil?: string;
}

export interface UpdateSsmMedicalControlRequest {
  performedAt?: string;
  result?: SsmMedicalControlResult;
  recommendations?: string;
  validityUntil?: string;
}

export interface SsmMedicalControlItem {
  id: string;
  employeeId: string;
  employeeName: string;
  controlTypeId: string;
  controlTypeCode: string;
  controlTypeName: string;
  controlTypeCategory?: SsmMedicalControlCategory;
  scheduledAt: string;
  performedAt?: string | null;
  result?: SsmMedicalControlResult | null;
  recommendations?: string | null;
  validityUntil?: string | null;
  nextDueAt?: string | null;
  aptitudeSheetName?: string | null;
  hasAptitudeSheet?: boolean;
}

export interface SsmMedicalReminderItem {
  controlId: string;
  employeeName: string;
  controlTypeName: string;
  nextDueAt: string;
  daysUntilDue: number;
}

export type SsmRiskTargetType = "JOB_POSITION" | "WORKSITE" | "DEPARTMENT";
export type SsmRiskAssessmentStatus = "ACTIVE" | "ARCHIVED";
export type SsmPreventionPlanStatus = "ACTIVE" | "ARCHIVED";
export type SsmPreventionMeasureStatus = "OPEN" | "COMPLETED" | "OVERDUE";

export interface SsmRiskFactor {
  name: string;
  category?: string;
  probability: number;
  severity: number;
  description?: string;
}

export interface SsmRiskMeasure {
  title: string;
  owner?: string;
  dueAt?: string;
  notes?: string;
}

export interface CreateSsmRiskAssessmentRequest {
  title: string;
  targetType: SsmRiskTargetType;
  jobPositionId?: string;
  worksiteId?: string;
  departmentId?: string;
  riskLevel: number;
  updateReason: string;
  factors: SsmRiskFactor[];
  measures: SsmRiskMeasure[];
  effectiveFrom?: string;
  /** Dacă e true, creează automat un Plan PPP legat, din măsurile versiunii. */
  createLinkedPreventionPlan?: boolean;
}

export interface AddSsmRiskAssessmentVersionRequest {
  riskLevel: number;
  updateReason: string;
  factors: SsmRiskFactor[];
  measures: SsmRiskMeasure[];
  effectiveFrom?: string;
}

export interface SsmRiskLinkedPreventionPlan {
  id: string;
  title: string;
  status: SsmPreventionPlanStatus;
  measureCount: number;
  openMeasures: number;
}

export interface SsmRiskAssessmentItem {
  id: string;
  title: string;
  targetType: SsmRiskTargetType;
  targetId?: string | null;
  targetLabel?: string | null;
  status: SsmRiskAssessmentStatus;
  riskLevel?: number | null;
  activeVersionNumber?: number | null;
  updateReason?: string | null;
  preventionPlans: SsmRiskLinkedPreventionPlan[];
  updatedAt: string;
  createdAt: string;
}

export interface SsmRiskAssessmentVersion {
  id: string;
  versionNumber: number;
  updateReason: string;
  factors: SsmRiskFactor[];
  measures: SsmRiskMeasure[];
  riskLevel: number;
  effectiveFrom?: string | null;
  createdBy: string;
  createdAt: string;
}

export interface SsmRiskAssessmentHistoryResponse {
  assessmentId: string;
  title: string;
  activeVersionId?: string | null;
  versions: SsmRiskAssessmentVersion[];
}

export interface CreateSsmPreventionPlanFromRiskResponse {
  planId: string;
  measureCount: number;
}

export type SsmPsiEquipmentStatus = "ACTIVE" | "RETIRED";
export type SsmPsiResponsibleRole =
  | "PSI_RESPONSIBLE"
  | "EMERGENCY_COORDINATOR"
  | "EVACUATION_RESPONSIBLE"
  | "FIRST_AID_RESPONSIBLE";

export const SSM_PSI_EQUIPMENT_CATEGORIES = [
  "EXTINGUISHER",
  "HYDRANT",
  "DETECTION_SYSTEM",
  "OTHER"
] as const;
export type SsmPsiEquipmentCategory = (typeof SSM_PSI_EQUIPMENT_CATEGORIES)[number];

export const SSM_PSI_DOC_KINDS = [
  "INSTRUCTIONS",
  "EVACUATION_PLAN",
  "INTERVENTION",
  "OTHER"
] as const;
export type SsmPsiDocKind = (typeof SSM_PSI_DOC_KINDS)[number];

export interface CreateSsmPsiEquipmentRequest {
  worksiteId: string;
  code: string;
  name: string;
  category: SsmPsiEquipmentCategory;
  serialNumber?: string;
  location?: string;
  verificationIntervalDays: number;
  reminderDays?: number[];
  lastVerifiedAt?: string;
  nextDueAt?: string;
  notes?: string;
}

export interface UpdateSsmPsiEquipmentRequest {
  name?: string;
  category?: SsmPsiEquipmentCategory;
  serialNumber?: string;
  location?: string;
  verificationIntervalDays?: number;
  reminderDays?: number[];
  notes?: string;
  status?: SsmPsiEquipmentStatus;
}

export interface RegisterSsmPsiEquipmentVerificationRequest {
  equipmentId: string;
  performedAt: string;
  nextDueAt?: string;
  result: string;
  notes?: string;
  documentId?: string;
}

export interface SsmPsiEquipmentItem {
  id: string;
  worksiteId: string;
  worksiteName: string;
  code: string;
  name: string;
  category: SsmPsiEquipmentCategory;
  serialNumber?: string | null;
  location?: string | null;
  verificationIntervalDays: number;
  reminderDays: number[];
  lastVerifiedAt?: string | null;
  nextDueAt?: string | null;
  status: SsmPsiEquipmentStatus;
  notes?: string | null;
}

export interface SsmPsiEquipmentVerificationItem {
  id: string;
  equipmentId: string;
  performedAt: string;
  nextDueAt: string;
  result: string;
  notes?: string | null;
  documentId?: string | null;
  createdAt: string;
}

export interface SsmPsiEquipmentNotification {
  equipmentId: string;
  code: string;
  name: string;
  worksiteName: string;
  nextDueAt: string;
  daysUntilDue: number;
}

export interface SsmPsiDocumentItem {
  id: string;
  title: string;
  type: SsmDocumentType;
  kind: SsmPsiDocKind;
  targetType: SsmDocumentTargetType;
  targetLabel?: string | null;
  activeVersionNumber?: number | null;
  fileName?: string | null;
  updatedAt: string;
}

export interface SsmPsiWorksiteDocumentation {
  id: string;
  code: string;
  name: string;
  documents: SsmPsiDocumentItem[];
  coverage: {
    instructions: boolean;
    evacuationPlan: boolean;
    intervention: boolean;
  };
}

export interface CreateSsmPsiTrainingRecordRequest {
  worksiteId: string;
  employeeId?: string;
  trainingTypeId?: string;
  topic: string;
  conductedAt: string;
  validUntil?: string;
  trainerName: string;
  responsibleName?: string;
  evidenceDocumentId?: string;
  notes?: string;
}

export interface SsmPsiTrainingRecordItem {
  id: string;
  worksiteId: string;
  worksiteName: string;
  employeeId?: string | null;
  employeeName?: string | null;
  trainingTypeId?: string | null;
  trainingTypeName?: string | null;
  trainingTypeCategory?: string | null;
  topic: string;
  conductedAt: string;
  validUntil?: string | null;
  trainerName: string;
  responsibleName?: string | null;
  evidenceDocumentId?: string | null;
  notes?: string | null;
  source: "PSI_REGISTER" | "TRAINING_SUITE";
}

export interface CreateSsmPsiResponsibleRequest {
  worksiteId: string;
  employeeId?: string;
  role: SsmPsiResponsibleRole;
  personName: string;
  email?: string;
  phone?: string;
  active?: boolean;
  notes?: string;
}

export interface SsmPsiResponsibleItem {
  id: string;
  worksiteId: string;
  worksiteName: string;
  employeeId?: string | null;
  employeeName?: string | null;
  role: SsmPsiResponsibleRole;
  personName: string;
  email?: string | null;
  phone?: string | null;
  active: boolean;
  notes?: string | null;
}

export interface DispatchSsmPsiRemindersResponse {
  sent: number;
  sentEmail: number;
  sentInApp: number;
  candidates: number;
}

export type SsmCalendarSource = "TRAINING" | "MEDICAL" | "EIP" | "PSI" | "PSI_TRAINING";
export type SsmTrafficLight = "GREEN" | "YELLOW" | "RED";
export type SsmReportType = "trainings" | "eip" | "medical" | "documents" | "accidents" | "psi" | "compliance";

export interface SsmUnifiedCalendarEvent {
  id: string;
  source: SsmCalendarSource;
  title: string;
  startAt: string;
  dueAt?: string | null;
  status: string;
  ownerLabel?: string | null;
}

export interface SsmUnifiedCalendarResponse {
  events: SsmUnifiedCalendarEvent[];
}

export interface SsmComplianceBreakdownItem {
  module: string;
  total: number;
  compliant: number;
  noncompliant: number;
  score: number;
}

export interface SsmTopNonconformity {
  module: string;
  count: number;
  score: number;
}

export interface SsmOverdueItem {
  id: string;
  module: string;
  title: string;
  subject: string;
  dueAt?: string | null;
  daysOverdue: number;
  severity: string;
}

export interface SsmComplianceDashboardResponse {
  kpi: {
    globalScore: number;
    trafficLight: SsmTrafficLight;
    totalChecks: number;
    noncompliant: number;
  };
  breakdown: SsmComplianceBreakdownItem[];
  topNonconformities: SsmTopNonconformity[];
  overdueItems: SsmOverdueItem[];
}

export type SsmReportRow = Record<string, string | number | boolean | null>;

export interface SsmReportResponse {
  type: SsmReportType;
  generatedAt: string;
  rows: SsmReportRow[];
}

export interface SsmPreventionMeasureItem {
  id: string;
  planId: string;
  description: string;
  responsiblePerson?: string | null;
  dueDate?: string | null;
  status: SsmPreventionMeasureStatus;
  completedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SsmPreventionPlanItem {
  id: string;
  title: string;
  targetType: SsmRiskTargetType;
  jobPositionId?: string | null;
  worksiteId?: string | null;
  departmentId?: string | null;
  jobPositionName?: string | null;
  worksiteName?: string | null;
  departmentName?: string | null;
  riskAssessmentId?: string | null;
  riskAssessmentTitle?: string | null;
  status: SsmPreventionPlanStatus;
  reviewDate?: string | null;
  notes?: string | null;
  measureCount: number;
  openMeasures: number;
  measures: SsmPreventionMeasureItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateSsmPreventionPlanRequest {
  title: string;
  targetType: SsmRiskTargetType;
  jobPositionId?: string;
  worksiteId?: string;
  departmentId?: string;
  riskAssessmentId?: string;
  reviewDate?: string;
  notes?: string;
}

export interface CreateSsmPreventionMeasureRequest {
  planId: string;
  description: string;
  responsiblePerson?: string;
  dueDate?: string;
  notes?: string;
}

export interface UpdateSsmPreventionMeasureRequest {
  description?: string;
  responsiblePerson?: string;
  dueDate?: string;
  status?: SsmPreventionMeasureStatus;
  notes?: string;
}

export interface SsmEvacuationDrillItem {
  id: string;
  worksiteId: string;
  worksiteName: string;
  conductedAt: string;
  nextDueAt?: string | null;
  durationMinutes?: number | null;
  participantsCount?: number | null;
  result: string;
  coordinatorName?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface CreateSsmEvacuationDrillRequest {
  worksiteId: string;
  conductedAt: string;
  nextDueAt?: string;
  durationMinutes?: number;
  participantsCount?: number;
  result: string;
  coordinatorName?: string;
  notes?: string;
}
