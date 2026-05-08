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

export interface CompleteSsmTestRequest {
  trainingPlanId: string;
  score: number;
  durationSeconds: number;
  passed: boolean;
  answersJson?: Record<string, unknown>;
}

export interface SignSsmTrainingPlanRequest {
  role: "EMPLOYEE" | "RESPONSIBLE";
  signatureData: string;
}

export interface SignSsmTrainingBatchRequest {
  planIds: string[];
  role: "EMPLOYEE" | "RESPONSIBLE";
  signatureData: string;
}

export interface SsmTrainingPlanItem {
  id: string;
  employeeId: string;
  trainingTypeId: string;
  trainingTypeCode: string;
  trainingTypeName: string;
  employeeName: string;
  scheduledAt: string;
  dueAt: string;
  completedAt?: string | null;
  score?: number | null;
  durationMinutes?: number | null;
  status: SsmTrainingPlanStatus;
  blockedAdmission: boolean;
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

export type SsmEipMovementType = "DISTRIBUTION" | "RETURN" | "SCRAP";

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
  employeeId: string;
  eipTypeId: string;
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
  employeeId: string;
  employeeName: string;
  eipTypeId: string;
  eipTypeName: string;
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
}

export interface SsmEipStockGapItem {
  eipTypeId: string;
  eipTypeName: string;
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
  type: SsmAccidentType;
  severity: SsmAccidentSeverity;
  title: string;
  occurredAt: string;
  location?: string;
  description: string;
  legalDaysDeadline?: number;
}

export interface CreateSsmAccidentTaskRequest {
  accidentCaseId: string;
  title: string;
  assignedTo?: string;
  dueAt: string;
  notes?: string;
}

export interface CloseSsmAccidentCaseRequest {
  conclusions: string;
  correctiveMeasures: string;
}

export interface SsmAccidentTaskItem {
  id: string;
  title: string;
  assignedTo?: string | null;
  dueAt: string;
  completedAt?: string | null;
  notes?: string | null;
}

export interface SsmAccidentCaseItem {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  type: SsmAccidentType;
  severity: SsmAccidentSeverity;
  status: SsmAccidentCaseStatus;
  title: string;
  occurredAt: string;
  dueAt: string;
  location?: string | null;
  conclusions?: string | null;
  correctiveMeasures?: string | null;
  tasks: SsmAccidentTaskItem[];
}

export interface SsmAccidentStats {
  byType: Record<SsmAccidentType, number>;
  bySeverity: Record<SsmAccidentSeverity, number>;
  openCases: number;
  overdueTasks: number;
  totalCases: number;
}

export type SsmMedicalControlResult = "FIT" | "FIT_CONDITIONAL" | "TEMPORARY_UNFIT" | "UNFIT";

export interface CreateSsmMedicalControlTypeRequest {
  code: string;
  name: string;
  jobPositionId?: string;
  recurrenceDays?: number;
  reminderDays?: number[];
}

export interface SsmMedicalControlTypeItem {
  id: string;
  code: string;
  name: string;
  jobPositionId?: string | null;
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

export interface SsmMedicalControlItem {
  id: string;
  employeeId: string;
  employeeName: string;
  controlTypeId: string;
  controlTypeCode: string;
  controlTypeName: string;
  scheduledAt: string;
  performedAt?: string | null;
  result?: SsmMedicalControlResult | null;
  recommendations?: string | null;
  validityUntil?: string | null;
  nextDueAt?: string | null;
  aptitudeSheetName?: string | null;
}

export interface SsmMedicalReminderItem {
  controlId: string;
  employeeName: string;
  controlTypeName: string;
  nextDueAt: string;
  daysUntilDue: number;
}
