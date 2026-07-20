import type { SsmReportType } from "./ssm";

export const SSM_REPORT_CADENCES = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type SsmReportCadence = (typeof SSM_REPORT_CADENCES)[number];

export const SSM_REPORT_DELIVERY_FORMATS = ["PDF", "XLSX", "BOTH"] as const;
export type SsmReportDeliveryFormat = (typeof SSM_REPORT_DELIVERY_FORMATS)[number];

export interface SsmScheduledReportRow {
  id: string;
  tenantId: string;
  reportType: SsmReportType | string;
  cadence: SsmReportCadence;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  recipients: string[];
  format: SsmReportDeliveryFormat;
  active: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSsmScheduledReportRequest {
  reportType: SsmReportType | string;
  cadence: SsmReportCadence;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  recipients: string[];
  format?: SsmReportDeliveryFormat;
  active?: boolean;
}

export interface UpdateSsmScheduledReportRequest {
  reportType?: SsmReportType | string;
  cadence?: SsmReportCadence;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  recipients?: string[];
  format?: SsmReportDeliveryFormat;
  active?: boolean;
}
