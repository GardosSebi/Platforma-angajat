import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { RetentionService } from "../retention/retention.service";
import { SsmTrainingSuiteService } from "../../modules/ssm/application/services/ssm-training-suite.service";
import { SsmMedicalService } from "../../modules/ssm/application/services/ssm-medical.service";
import { SsmEipService } from "../../modules/ssm/application/services/ssm-eip.service";
import { SsmTrainingAutomationService } from "../../modules/ssm/application/services/ssm-training-automation.service";
import { CommunicationsService } from "../../modules/chatbot/application/services/communications.service";
import { SurveysService } from "../../modules/surveys/application/services/surveys.service";
import { SsmScheduledReportsService } from "../../modules/ssm/application/services/ssm-scheduled-reports.service";
import { isCronEnabled, SYSTEM_CRON_ACTOR } from "./scheduler.constants";

@Injectable()
export class PlatformCronService {
  private readonly logger = new Logger(PlatformCronService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly trainingSuite: SsmTrainingSuiteService,
    private readonly medicalService: SsmMedicalService,
    private readonly eipService: SsmEipService,
    private readonly trainingAutomation: SsmTrainingAutomationService,
    private readonly communications: CommunicationsService,
    private readonly surveys: SurveysService,
    private readonly retention: RetentionService,
    private readonly scheduledReports: SsmScheduledReportsService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async runDailyJobs() {
    if (!isCronEnabled()) return;
    if (this.running) {
      this.logger.warn("Skipping daily cron — previous run still in progress.");
      return;
    }
    this.running = true;
    try {
      const tenants = await this.prisma.tenant.findMany({ where: { active: true }, select: { id: true } });
      this.logger.log(`Daily cron started for ${tenants.length} tenant(s).`);
      for (const tenant of tenants) {
        await this.runForTenant(tenant.id);
      }
      this.logger.log("Daily cron finished.");
    } catch (error) {
      this.logger.error("Daily cron failed.", error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }
  }

  async runForTenant(tenantId: string) {
    const overdue = await this.trainingSuite.markOverduePlans(tenantId);
    const training = await this.trainingSuite.dispatchReminders(tenantId, SYSTEM_CRON_ACTOR);
    const medical = await this.medicalService.dispatchMedicalReminders(tenantId, SYSTEM_CRON_ACTOR);
    const eip = await this.eipService.dispatchReminders(tenantId, SYSTEM_CRON_ACTOR);
    const published = await this.communications.publishDueScheduled(tenantId, SYSTEM_CRON_ACTOR);
    const archivedAnnouncements = await this.communications.archiveExpiredAnnouncements(
      tenantId,
      SYSTEM_CRON_ACTOR
    );
    const commReminders = await this.communications.dispatchReminders(tenantId, SYSTEM_CRON_ACTOR);
    const closedSurveys = await this.surveys.closeExpiredSurveys(tenantId, SYSTEM_CRON_ACTOR);
    const retention = await this.retention.archiveExpiredDocumentVersions(tenantId);
    const absence = await this.trainingAutomation.processAbsenceTriggers(tenantId, SYSTEM_CRON_ACTOR);
    const scheduledReports = await this.scheduledReports.dispatchDueForTenant(tenantId);
    this.logger.log(
      `Tenant ${tenantId}: trainingOverdue=${overdue.marked}, trainingReminders=${training.sent}, medicalReminders=${medical.sent}, eipReminders=${eip.sent}, absenceTriggers=${absence.assigned}, announcementsPublished=${published.published}, announcementsArchived=${archivedAnnouncements.archived}, commReminders=${commReminders.sent}, surveysClosed=${closedSurveys.closed}, retentionArchived=${retention.archived}, scheduledReports=${scheduledReports.sent}`
    );
    return {
      overdue,
      training,
      medical,
      eip,
      absence,
      published,
      archivedAnnouncements,
      commReminders,
      closedSurveys,
      retention,
      scheduledReports
    };
  }
}
