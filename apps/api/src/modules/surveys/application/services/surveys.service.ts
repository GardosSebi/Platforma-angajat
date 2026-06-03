import { randomBytes, createHash } from "crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Survey, SurveyAudienceType, SurveyStatus, SurveyType } from "@prisma/client";
import PDFDocument from "pdfkit";
import { PrismaService } from "../../../../infrastructure/prisma/prisma.service";
import { AuditLogService } from "../../../../infrastructure/logging/audit-log.service";
import { PaginationQueryDto, resolvePagination } from "../../../../common/dto/pagination-query.dto";
import { paginatedResult } from "../../../../common/pagination";
import {
  CreatePublicLinkDto,
  CreateSurveyDto,
  SubmitSurveyResponseDto,
  SurveyQuestionDto,
  UpdateSurveyDto
} from "../../api/dto/surveys.dto";
import { findEmployeeIdForUserEmail } from "../../../ssm/api/ssm-viewer-scope";

type AnswerValue = string | number | boolean | string[] | null;
type Answers = Record<string, AnswerValue>;

function clean(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanNullable(value?: string | null): string | null | undefined {
  if (value === undefined) return undefined;
  return clean(value) ?? null;
}

function dedupe(values?: string[]): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  return date;
}

function jsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function excelBuffer(rows: Record<string, unknown>[]): Buffer {
  const headers = rows[0] ? Object.keys(rows[0]) : ["message"];
  const data = rows.length ? rows : [{ message: "No responses" }];
  const lines = [headers.join("\t"), ...data.map((row) => headers.map((header) => formatCell(row[header])).join("\t"))];
  return Buffer.from(lines.join("\n"), "utf8");
}

function pdfBuffer(title: string, rows: Record<string, unknown>[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 36, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(16).text(title, { underline: true });
    doc.moveDown();
    doc.fontSize(9);
    const sample = rows.slice(0, 70);
    for (const row of sample) {
      doc.text(Object.entries(row).map(([key, value]) => `${key}: ${formatCell(value)}`).join(" | "));
      doc.moveDown(0.35);
    }
    if (rows.length > sample.length) {
      doc.moveDown().text(`... ${rows.length - sample.length} rows omitted`);
    }
    doc.end();
  });
}

@Injectable()
export class SurveysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService
  ) {}

  async overview(tenantId: string) {
    const [surveys, responses] = await Promise.all([
      this.prisma.survey.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 5 }),
      this.prisma.surveyResponse.count({ where: { tenantId } })
    ]);
    const active = surveys.filter((survey) => survey.status === SurveyStatus.ACTIVE).length;
    return {
      kpi: {
        activeSurveys: active,
        draftSurveys: surveys.filter((survey) => survey.status === SurveyStatus.DRAFT).length,
        totalResponses: responses,
        publicLinks: surveys.filter((survey) => survey.publicEnabled).length
      },
      latestSurveys: await this.withStats(tenantId, surveys)
    };
  }

  async list(tenantId: string, query?: PaginationQueryDto) {
    const p = resolvePagination(query);
    const where = { tenantId };
    const [surveys, total] = await Promise.all([
      this.prisma.survey.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: p.skip,
        take: p.take
      }),
      this.prisma.survey.count({ where })
    ]);
    const items = await this.withStats(tenantId, surveys);
    return paginatedResult(items, total, p.page, p.pageSize);
  }

  async create(tenantId: string, actorId: string, dto: CreateSurveyDto) {
    this.assertQuestions(dto.questionSchema);
    await this.assertAudience(tenantId, dto.audienceType ?? SurveyAudienceType.ALL, dto.audienceRefId, dto.targetEmployeeIds);

    const survey = await this.prisma.survey.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        description: clean(dto.description),
        surveyType: dto.surveyType ?? SurveyType.ENGAGEMENT,
        audienceType: dto.audienceType ?? SurveyAudienceType.ALL,
        closesAt: dto.closesAt ? parseDate(dto.closesAt) : undefined,
        audienceRefId: clean(dto.audienceRefId),
        audienceLabel: clean(dto.audienceLabel),
        targetEmployeeIds: dedupe(dto.targetEmployeeIds),
        questionSchema: jsonValue(dto.questionSchema),
        conditionalLogic: dto.conditionalLogic ? jsonValue(dto.conditionalLogic) : undefined,
        privateLinkEnabled: dto.privateLinkEnabled ?? true,
        createdBy: actorId
      }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SURVEYS",
      action: "SURVEY_CREATED",
      entityType: "Survey",
      entityId: survey.id,
      payload: { questionCount: dto.questionSchema.length, audienceType: survey.audienceType }
    });

    return this.get(tenantId, survey.id);
  }

  async update(tenantId: string, actorId: string, id: string, dto: UpdateSurveyDto) {
    const current = await this.assertSurvey(tenantId, id);
    if (dto.questionSchema) {
      this.assertQuestions(dto.questionSchema);
    }
    await this.assertAudience(
      tenantId,
      dto.audienceType ?? current.audienceType,
      dto.audienceRefId ?? current.audienceRefId,
      dto.targetEmployeeIds ?? current.targetEmployeeIds
    );

    await this.prisma.survey.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: cleanNullable(dto.description),
        surveyType: dto.surveyType,
        status: dto.status,
        closesAt: dto.closesAt === undefined ? undefined : dto.closesAt ? parseDate(dto.closesAt) : null,
        audienceType: dto.audienceType,
        audienceRefId: dto.audienceRefId === undefined ? undefined : clean(dto.audienceRefId) ?? null,
        audienceLabel: dto.audienceLabel === undefined ? undefined : clean(dto.audienceLabel) ?? null,
        targetEmployeeIds: dto.targetEmployeeIds === undefined ? undefined : dedupe(dto.targetEmployeeIds),
        questionSchema: dto.questionSchema ? jsonValue(dto.questionSchema) : undefined,
        conditionalLogic: dto.conditionalLogic === undefined ? undefined : jsonValue(dto.conditionalLogic),
        privateLinkEnabled: dto.privateLinkEnabled
      }
    });

    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SURVEYS",
      action: "SURVEY_UPDATED",
      entityType: "Survey",
      entityId: id
    });

    return this.get(tenantId, id);
  }

  async activate(tenantId: string, actorId: string, id: string) {
    await this.assertSurvey(tenantId, id);
    await this.prisma.survey.update({ where: { id }, data: { status: SurveyStatus.ACTIVE } });
    await this.auditLog.write({ tenantId, actorId, module: "SURVEYS", action: "SURVEY_ACTIVATED", entityType: "Survey", entityId: id });
    return this.get(tenantId, id);
  }

  async close(tenantId: string, actorId: string, id: string) {
    await this.assertSurvey(tenantId, id);
    await this.prisma.survey.update({ where: { id }, data: { status: SurveyStatus.CLOSED } });
    await this.auditLog.write({ tenantId, actorId, module: "SURVEYS", action: "SURVEY_CLOSED", entityType: "Survey", entityId: id });
    return this.get(tenantId, id);
  }

  async getForRespond(tenantId: string, id: string, userId: string, email: string) {
    const survey = await this.assertSurvey(tenantId, id);
    if (survey.status !== SurveyStatus.ACTIVE) {
      throw new BadRequestException("Sondajul nu este activ.");
    }
    const employeeId = await findEmployeeIdForUserEmail(this.prisma, tenantId, email);
    await this.assertEmployeeMayRespondToSurvey(tenantId, survey, employeeId);
    const existing = await this.findUserSurveyResponse(tenantId, id, userId);
    return {
      ...this.serializeSurvey(survey, { responseCount: 0, privateResponses: 0, publicResponses: 0 }),
      alreadyResponded: Boolean(existing),
      respondedAt: existing?.submittedAt.toISOString() ?? null
    };
  }

  async getRespondedSurveyIds(tenantId: string, userId: string) {
    const rows = await this.prisma.surveyResponse.findMany({
      where: { tenantId, respondentUserId: userId },
      select: { surveyId: true },
      distinct: ["surveyId"]
    });
    return { surveyIds: rows.map((row) => row.surveyId) };
  }

  async listAvailableForUser(tenantId: string, userId: string, email: string) {
    const employeeId = await findEmployeeIdForUserEmail(this.prisma, tenantId, email);
    if (!employeeId) {
      return { items: [] as Array<{ id: string; title: string; description: string | null; alreadyResponded: boolean }> };
    }

    const [surveys, respondedRows] = await Promise.all([
      this.prisma.survey.findMany({
        where: { tenantId, status: SurveyStatus.ACTIVE },
        orderBy: { updatedAt: "desc" }
      }),
      this.prisma.surveyResponse.findMany({
        where: { tenantId, respondentUserId: userId },
        select: { surveyId: true },
        distinct: ["surveyId"]
      })
    ]);
    const responded = new Set(respondedRows.map((row) => row.surveyId));
    const items: Array<{ id: string; title: string; description: string | null; alreadyResponded: boolean }> = [];

    for (const survey of surveys) {
      const audienceIds = await this.resolveSurveyAudienceEmployeeIds(tenantId, survey);
      if (!audienceIds.includes(employeeId)) {
        continue;
      }
      items.push({
        id: survey.id,
        title: survey.title,
        description: survey.description,
        alreadyResponded: responded.has(survey.id)
      });
    }

    return { items };
  }

  private async assertEmployeeMayRespondToSurvey(
    tenantId: string,
    survey: Survey,
    employeeId: string | null
  ): Promise<void> {
    if (!employeeId) {
      throw new ForbiddenException(
        "Contul nu este asociat unui angajat. Contactați HR pentru legarea e-mailului cu fișa de personal."
      );
    }
    const audienceIds = await this.resolveSurveyAudienceEmployeeIds(tenantId, survey);
    if (!audienceIds.includes(employeeId)) {
      throw new ForbiddenException("Acest sondaj nu vă este destinat.");
    }
  }

  private async resolveSurveyAudienceEmployeeIds(tenantId: string, survey: Survey): Promise<string[]> {
    if (survey.audienceType === SurveyAudienceType.ALL) {
      const rows = await this.prisma.employee.findMany({
        where: { tenantId, active: true },
        select: { id: true }
      });
      return rows.map((item) => item.id);
    }
    if (survey.audienceType === SurveyAudienceType.WORKSITE) {
      const rows = await this.prisma.employee.findMany({
        where: { tenantId, active: true, worksiteId: survey.audienceRefId },
        select: { id: true }
      });
      return rows.map((item) => item.id);
    }
    if (survey.audienceType === SurveyAudienceType.DEPARTMENT) {
      const rows = await this.prisma.employee.findMany({
        where: { tenantId, active: true, departmentId: survey.audienceRefId },
        select: { id: true }
      });
      return rows.map((item) => item.id);
    }
    if (survey.audienceType === SurveyAudienceType.JOB_POSITION) {
      const rows = await this.prisma.employee.findMany({
        where: { tenantId, active: true, jobPositionId: survey.audienceRefId },
        select: { id: true }
      });
      return rows.map((item) => item.id);
    }
    if (survey.audienceType === SurveyAudienceType.EMPLOYEE_GROUP) {
      const rows = await this.prisma.employeeGroupMember.findMany({
        where: { group: { id: survey.audienceRefId ?? undefined, tenantId, active: true } },
        select: { employeeId: true }
      });
      return rows.map((item) => item.employeeId);
    }
    if (survey.audienceType === SurveyAudienceType.EMPLOYEE) {
      return survey.audienceRefId ? [survey.audienceRefId] : [];
    }
    return dedupe(survey.targetEmployeeIds);
  }

  async privateLink(tenantId: string, id: string) {
    const survey = await this.assertSurvey(tenantId, id);
    if (!survey.privateLinkEnabled) {
      throw new BadRequestException("Private link is disabled for this survey.");
    }
    return { url: `/surveys/respond/${survey.id}`, surveyId: survey.id };
  }

  async createPublicLink(tenantId: string, actorId: string, id: string, dto: CreatePublicLinkDto) {
    const survey = await this.assertSurvey(tenantId, id);
    const expiresAt = parseDate(dto.expiresAt);
    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("Public link expiration must be in the future.");
    }
    const token = survey.publicToken ?? randomBytes(24).toString("hex");
    const updated = await this.prisma.survey.update({
      where: { id },
      data: {
        publicToken: token,
        publicEnabled: true,
        publicExpiresAt: expiresAt,
        publicResponseLimit: dto.responseLimit ?? null
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId,
      module: "SURVEYS",
      action: "PUBLIC_LINK_CREATED",
      entityType: "Survey",
      entityId: id,
      payload: { expiresAt, responseLimit: dto.responseLimit }
    });
    return {
      url: `/surveys/public/${token}`,
      token,
      expiresAt: updated.publicExpiresAt,
      responseLimit: updated.publicResponseLimit
    };
  }

  async publicSurvey(token: string) {
    const survey = await this.assertPublicSurvey(token);
    return this.serializeSurvey(survey, { responseCount: 0, privateResponses: 0, publicResponses: 0 });
  }

  async submitPrivateResponse(
    tenantId: string,
    actorId: string,
    surveyId: string,
    dto: SubmitSurveyResponseDto,
    email: string
  ) {
    const survey = await this.assertSurvey(tenantId, surveyId);
    this.assertCanRespond(survey);
    const resolvedEmployeeId =
      clean(dto.employeeId) ?? (await findEmployeeIdForUserEmail(this.prisma, tenantId, email)) ?? undefined;
    await this.assertEmployeeMayRespondToSurvey(tenantId, survey, resolvedEmployeeId ?? null);
    if (resolvedEmployeeId) {
      await this.assertEmployee(tenantId, resolvedEmployeeId);
    }
    const existing = await this.findUserSurveyResponse(tenantId, surveyId, actorId);
    if (existing) {
      throw new ConflictException("Ați completat deja acest sondaj.");
    }
    try {
      const response = await this.prisma.surveyResponse.create({
        data: {
          tenantId,
          surveyId,
          employeeId: resolvedEmployeeId ?? null,
          respondentUserId: actorId,
          answersJson: jsonValue(dto.answers)
        }
      });
      return { responseId: response.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Ați completat deja acest sondaj.");
      }
      throw error;
    }
  }

  async submitPublicResponse(token: string, dto: SubmitSurveyResponseDto, meta: { ip?: string; userAgent?: string }) {
    const survey = await this.assertPublicSurvey(token);
    this.assertCanRespond(survey);
    if (survey.publicResponseLimit && survey.publicResponseCount >= survey.publicResponseLimit) {
      throw new BadRequestException("Public response limit reached.");
    }
    const response = await this.prisma.$transaction(async (tx) => {
      const created = await tx.surveyResponse.create({
        data: {
          tenantId: survey.tenantId,
          surveyId: survey.id,
          publicToken: token,
          answersJson: jsonValue(dto.answers),
          ipHash: meta.ip ? createHash("sha256").update(meta.ip).digest("hex") : undefined,
          userAgent: meta.userAgent?.slice(0, 300)
        }
      });
      await tx.survey.update({ where: { id: survey.id }, data: { publicResponseCount: { increment: 1 } } });
      return created;
    });
    return { responseId: response.id };
  }

  async stats(tenantId: string, id: string) {
    const survey = await this.assertSurvey(tenantId, id);
    const responses = await this.prisma.surveyResponse.findMany({ where: { tenantId, surveyId: id } });
    return this.buildStats(survey, responses);
  }

  async exportJson(tenantId: string, id: string) {
    const rows = await this.exportRows(tenantId, id);
    return Buffer.from(JSON.stringify({ surveyId: id, rows }, null, 2), "utf8");
  }

  async exportExcel(tenantId: string, id: string) {
    return excelBuffer(await this.exportRows(tenantId, id));
  }

  async exportPdf(tenantId: string, id: string) {
    const survey = await this.assertSurvey(tenantId, id);
    return pdfBuffer(`Raport sondaj - ${survey.title}`, await this.exportRows(tenantId, id));
  }

  private async get(tenantId: string, id: string) {
    const survey = await this.assertSurvey(tenantId, id);
    const [item] = await this.withStats(tenantId, [survey]);
    return item;
  }

  private async assertSurvey(tenantId: string, id: string) {
    const survey = await this.prisma.survey.findFirst({ where: { tenantId, id } });
    if (!survey) throw new NotFoundException("Survey not found for tenant.");
    return survey;
  }

  private async assertPublicSurvey(token: string) {
    const survey = await this.prisma.survey.findUnique({ where: { publicToken: token } });
    if (!survey || !survey.publicEnabled) throw new NotFoundException("Public survey link not found.");
    if (survey.publicExpiresAt && survey.publicExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Public survey link expired.");
    }
    return survey;
  }

  private assertCanRespond(survey: Survey) {
    if (survey.status !== SurveyStatus.ACTIVE) {
      throw new BadRequestException("Survey is not active.");
    }
  }

  private findUserSurveyResponse(tenantId: string, surveyId: string, userId: string) {
    return this.prisma.surveyResponse.findFirst({
      where: { tenantId, surveyId, respondentUserId: userId },
      select: { id: true, submittedAt: true }
    });
  }

  private async assertEmployee(tenantId: string, employeeId?: string) {
    if (!employeeId) return;
    const employee = await this.prisma.employee.findFirst({ where: { tenantId, id: employeeId, active: true } });
    if (!employee) throw new NotFoundException("Employee not found for tenant.");
  }

  private async assertAudience(tenantId: string, audienceType: SurveyAudienceType, audienceRefId?: string | null, targetEmployeeIds?: string[]) {
    if (audienceType === SurveyAudienceType.ALL) return;
    if (audienceType === SurveyAudienceType.CUSTOM) {
      const ids = dedupe(targetEmployeeIds);
      if (!ids.length) throw new BadRequestException("Custom audience requires targetEmployeeIds.");
      const count = await this.prisma.employee.count({ where: { tenantId, active: true, id: { in: ids } } });
      if (count !== ids.length) throw new NotFoundException("One or more target employees were not found for tenant.");
      return;
    }
    if (!audienceRefId?.trim()) {
      throw new BadRequestException(`${audienceType} audience requires audienceRefId.`);
    }
  }

  private assertQuestions(questions: SurveyQuestionDto[]) {
    if (!questions.length) throw new BadRequestException("Survey requires at least one question.");
    const ids = new Set<string>();
    for (const question of questions) {
      if (ids.has(question.id)) throw new BadRequestException(`Duplicate question id: ${question.id}`);
      ids.add(question.id);
      if ((question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE") && !question.options?.length) {
        throw new BadRequestException(`${question.type} question requires options.`);
      }
    }
  }

  /** Închide sondajele active după data closesAt — cron zilnic. */
  async closeExpiredSurveys(tenantId: string, actorId: string) {
    const now = new Date();
    const due = await this.prisma.survey.findMany({
      where: {
        tenantId,
        status: SurveyStatus.ACTIVE,
        closesAt: { lte: now }
      }
    });
    for (const survey of due) {
      await this.prisma.survey.update({
        where: { id: survey.id },
        data: { status: SurveyStatus.CLOSED }
      });
    }
    if (due.length) {
      await this.auditLog.write({
        tenantId,
        actorId,
        module: "SURVEYS",
        action: "SURVEYS_AUTO_CLOSED",
        entityType: "Survey",
        entityId: "batch",
        payload: { closed: due.length }
      });
    }
    return { closed: due.length };
  }

  private async withStats(tenantId: string, surveys: Survey[]) {
    return Promise.all(
      surveys.map(async (survey) => {
        const [responseCount, privateResponses, publicResponses] = await Promise.all([
          this.prisma.surveyResponse.count({ where: { tenantId, surveyId: survey.id } }),
          this.prisma.surveyResponse.count({ where: { tenantId, surveyId: survey.id, publicToken: null } }),
          this.prisma.surveyResponse.count({ where: { tenantId, surveyId: survey.id, publicToken: { not: null } } })
        ]);
        return this.serializeSurvey(survey, { responseCount, privateResponses, publicResponses });
      })
    );
  }

  private serializeSurvey(
    survey: Survey,
    stats: { responseCount: number; privateResponses: number; publicResponses: number }
  ) {
    const questionSchema = survey.questionSchema as unknown as SurveyQuestionDto[];
    return {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      surveyType: survey.surveyType,
      status: survey.status,
      closesAt: survey.closesAt,
      audienceType: survey.audienceType,
      audienceRefId: survey.audienceRefId,
      audienceLabel: survey.audienceLabel,
      targetEmployeeIds: survey.targetEmployeeIds,
      questionSchema,
      conditionalLogic: survey.conditionalLogic,
      privateLinkEnabled: survey.privateLinkEnabled,
      publicEnabled: survey.publicEnabled,
      publicExpiresAt: survey.publicExpiresAt,
      publicResponseLimit: survey.publicResponseLimit,
      publicResponseCount: survey.publicResponseCount,
      createdAt: survey.createdAt,
      updatedAt: survey.updatedAt,
      stats: {
        ...stats,
        questionCount: questionSchema.length
      }
    };
  }

  private buildStats(survey: Survey, responses: Array<{ answersJson: Prisma.JsonValue; publicToken: string | null }>) {
    const questions = survey.questionSchema as unknown as SurveyQuestionDto[];
    const questionStats = questions.map((question) => {
      const values = responses.map((response) => (response.answersJson as Answers)[question.id]).filter((value) => value !== undefined && value !== null);
      const optionStats = question.options?.map((option) => ({
        value: option.value,
        label: option.label,
        count: values.filter((value) => (Array.isArray(value) ? value.includes(option.value) : value === option.value)).length
      }));
      const numeric = values.filter((value): value is number => typeof value === "number");
      return {
        questionId: question.id,
        title: question.title,
        type: question.type,
        responseCount: values.length,
        options: optionStats,
        average: numeric.length ? Math.round((numeric.reduce((sum, value) => sum + value, 0) / numeric.length) * 100) / 100 : null
      };
    });
    return {
      surveyId: survey.id,
      title: survey.title,
      responseCount: responses.length,
      privateResponses: responses.filter((response) => !response.publicToken).length,
      publicResponses: responses.filter((response) => response.publicToken).length,
      questionStats
    };
  }

  private async exportRows(tenantId: string, id: string) {
    const survey = await this.assertSurvey(tenantId, id);
    const questions = survey.questionSchema as unknown as SurveyQuestionDto[];
    const responses = await this.prisma.surveyResponse.findMany({ where: { tenantId, surveyId: id }, orderBy: { submittedAt: "desc" } });
    return responses.map((response) => {
      const answers = response.answersJson as Answers;
      return {
        responseId: response.id,
        submittedAt: response.submittedAt.toISOString(),
        channel: response.publicToken ? "PUBLIC" : "PRIVATE",
        employeeId: response.employeeId,
        respondentUserId: response.respondentUserId,
        ...Object.fromEntries(questions.map((question) => [question.title, answers[question.id] ?? null]))
      };
    });
  }
}
