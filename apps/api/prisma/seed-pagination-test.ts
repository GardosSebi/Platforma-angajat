/**
 * Date volum pentru testarea paginării UI (minim 3 pagini la pageSize=25).
 *
 * Rulează după seed-ul de bază:
 *   pnpm --filter @apps/api prisma:seed
 *   pnpm --filter @apps/api prisma:seed:pagination
 *
 * Variabile:
 *   PAGINATION_SEED_TENANT_ID=e01   (implicit)
 *   PAGINATION_SEED_COUNT=80        (implicit; >25 pentru pagini multiple)
 */
import {
  CommunicationAnnouncementStatus,
  CommunicationAudienceType,
  CommunicationContentType,
  HelpdeskTicketPriority,
  HelpdeskTicketSource,
  HelpdeskTicketStatus,
  PrismaClient,
  SsmAccidentCaseStatus,
  SsmAccidentSeverity,
  SsmAccidentType,
  SsmDocumentTargetType,
  SsmDocumentType,
  SsmTrainingCategory,
  SsmTrainingPlanStatus,
  SurveyAudienceType,
  SurveyStatus,
  SystemRole
} from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};

const TENANT_ID = process.env.PAGINATION_SEED_TENANT_ID ?? "e01";
const CREATED_BY = "seed-pagination-test";
const COUNT = envInt("PAGINATION_SEED_COUNT", 80);

const DAY_MS = 24 * 60 * 60 * 1000;

const SURVEY_QUESTION_SCHEMA = {
  questions: [
    {
      id: "q1",
      type: "TEXT",
      title: "Comentariu (seed paginare)",
      required: false
    }
  ]
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pad(n: number, width = 3): string {
  return String(n).padStart(width, "0");
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
  if (!tenant) {
    throw new Error(`Tenant ${TENANT_ID} not found. Rulează mai întâi: pnpm --filter @apps/api prisma:seed`);
  }

  const hq = await prisma.worksite.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "HQ" } },
    update: { active: true },
    create: { tenantId: TENANT_ID, code: "HQ", name: "Sediu central", active: true }
  });

  const depHq = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "PAG-BASE-DEP" } },
    update: { name: "Departament bază paginare", active: true, worksiteId: hq.id },
    create: {
      tenantId: TENANT_ID,
      code: "PAG-BASE-DEP",
      name: "Departament bază paginare",
      active: true,
      worksiteId: hq.id
    }
  });

  const jobHq = await prisma.jobPosition.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "PAG-BASE-JOB" } },
    update: { name: "Post bază paginare", active: true, departmentId: depHq.id, corCode: "0000" },
    create: {
      tenantId: TENANT_ID,
      code: "PAG-BASE-JOB",
      name: "Post bază paginare",
      active: true,
      departmentId: depHq.id,
      corCode: "0000"
    }
  });

  const worksiteIds: string[] = [hq.id];
  const departmentIds: string[] = [depHq.id];
  const jobIds: string[] = [jobHq.id];
  const employeeIds: string[] = [];

  console.log(`[pagination-seed] Tenant ${TENANT_ID}, ${COUNT} înregistrări per listă…`);

  for (let i = 1; i <= COUNT; i += 1) {
    const p = pad(i);
    const ws = await prisma.worksite.upsert({
      where: { id: `seed-pag-ws-${p}` },
      update: {
        tenantId: TENANT_ID,
        code: `PAG-WS-${p}`,
        name: `Punct lucru paginare ${p}`,
        address: `Str. Test ${i}`,
        active: true
      },
      create: {
        id: `seed-pag-ws-${p}`,
        tenantId: TENANT_ID,
        code: `PAG-WS-${p}`,
        name: `Punct lucru paginare ${p}`,
        address: `Str. Test ${i}`,
        active: true
      }
    });
    worksiteIds.push(ws.id);

    const dep = await prisma.department.upsert({
      where: { id: `seed-pag-dep-${p}` },
      update: {
        tenantId: TENANT_ID,
        code: `PAG-DEP-${p}`,
        name: `Departament paginare ${p}`,
        worksiteId: ws.id,
        active: true
      },
      create: {
        id: `seed-pag-dep-${p}`,
        tenantId: TENANT_ID,
        code: `PAG-DEP-${p}`,
        name: `Departament paginare ${p}`,
        worksiteId: ws.id,
        active: true
      }
    });
    departmentIds.push(dep.id);

    const job = await prisma.jobPosition.upsert({
      where: { id: `seed-pag-job-${p}` },
      update: {
        tenantId: TENANT_ID,
        code: `PAG-JOB-${p}`,
        name: `Post paginare ${p}`,
        departmentId: dep.id,
        corCode: "0000",
        active: true
      },
      create: {
        id: `seed-pag-job-${p}`,
        tenantId: TENANT_ID,
        code: `PAG-JOB-${p}`,
        name: `Post paginare ${p}`,
        departmentId: dep.id,
        corCode: "0000",
        active: true
      }
    });
    jobIds.push(job.id);

    const emp = await prisma.employee.upsert({
      where: { id: `seed-pag-emp-${p}` },
      update: {
        tenantId: TENANT_ID,
        fullName: `Angajat paginare ${p}`,
        email: `paginare.angajat.${p}@company.local`,
        active: true,
        worksiteId: ws.id,
        departmentId: dep.id,
        jobPositionId: job.id
      },
      create: {
        id: `seed-pag-emp-${p}`,
        tenantId: TENANT_ID,
        fullName: `Angajat paginare ${p}`,
        email: `paginare.angajat.${p}@company.local`,
        active: true,
        worksiteId: ws.id,
        departmentId: dep.id,
        jobPositionId: job.id
      }
    });
    employeeIds.push(emp.id);
  }

  const demoEmployeeId =
    (
      await prisma.employee.findUnique({
        where: { id: "seed-demo-employee-e01" },
        select: { id: true }
      })
    )?.id ?? employeeIds[0]!;

  const trainingType = await prisma.ssmTrainingType.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "PAG-TRAIN-TYPE" } },
    update: {
      name: "Instruire paginare test",
      category: SsmTrainingCategory.PERIODIC,
      recurrenceDays: 365,
      reminderDays: [30, 15, 7],
      active: true
    },
    create: {
      tenantId: TENANT_ID,
      code: "PAG-TRAIN-TYPE",
      name: "Instruire paginare test",
      category: SsmTrainingCategory.PERIODIC,
      recurrenceDays: 365,
      reminderDays: [30, 15, 7],
      active: true
    }
  });

  const now = Date.now();
  const planStatuses = [
    SsmTrainingPlanStatus.PENDING,
    SsmTrainingPlanStatus.COMPLETED,
    SsmTrainingPlanStatus.OVERDUE
  ] as const;

  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!", 12);

  for (let i = 1; i <= COUNT; i += 1) {
    const p = pad(i);
    const employeeId = employeeIds[(i - 1) % employeeIds.length];
    const scheduledAt = new Date(now - i * DAY_MS);
    const dueAt = new Date(now + (i % 30) * DAY_MS);

    await prisma.ssmTrainingPlan.upsert({
      where: { id: `seed-pag-plan-${p}` },
      update: {
        tenantId: TENANT_ID,
        employeeId,
        trainingTypeId: trainingType.id,
        materialTitle: `Material plan ${p}`,
        scheduledAt,
        dueAt,
        status: planStatuses[i % planStatuses.length],
        createdBy: CREATED_BY
      },
      create: {
        id: `seed-pag-plan-${p}`,
        tenantId: TENANT_ID,
        employeeId,
        trainingTypeId: trainingType.id,
        materialTitle: `Material plan ${p}`,
        scheduledAt,
        dueAt,
        status: planStatuses[i % planStatuses.length],
        createdBy: CREATED_BY
      }
    });

    const docId = `seed-pag-doc-${p}`;
    await prisma.ssmDocument.upsert({
      where: { id: docId },
      update: {
        tenantId: TENANT_ID,
        title: `Document SSM paginare ${p}`,
        type: SsmDocumentType.OTHER,
        targetType: SsmDocumentTargetType.ALL,
        status: "ACTIVE",
        createdBy: CREATED_BY
      },
      create: {
        id: docId,
        tenantId: TENANT_ID,
        title: `Document SSM paginare ${p}`,
        type: SsmDocumentType.OTHER,
        targetType: SsmDocumentTargetType.ALL,
        status: "ACTIVE",
        createdBy: CREATED_BY
      }
    });

    const version = await prisma.ssmDocumentVersion.upsert({
      where: { documentId_versionNumber: { documentId: docId, versionNumber: 1 } },
      update: {
        tenantId: TENANT_ID,
        fileName: `doc-pag-${p}.pdf`,
        mimeType: "application/pdf",
        fileSize: 512,
        storagePath: `seed://pag/doc-${p}.pdf`,
        changeNote: "Seed paginare",
        createdBy: CREATED_BY
      },
      create: {
        tenantId: TENANT_ID,
        documentId: docId,
        versionNumber: 1,
        fileName: `doc-pag-${p}.pdf`,
        mimeType: "application/pdf",
        fileSize: 512,
        storagePath: `seed://pag/doc-${p}.pdf`,
        changeNote: "Seed paginare",
        createdBy: CREATED_BY
      }
    });

    await prisma.ssmDocument.update({
      where: { id: docId },
      data: { activeVersionId: version.id }
    });

    const accidentStatuses = [
      SsmAccidentCaseStatus.OPEN,
      SsmAccidentCaseStatus.IN_RESEARCH,
      SsmAccidentCaseStatus.CLOSED
    ] as const;

    await prisma.ssmAccidentCase.upsert({
      where: { id: `seed-pag-acc-${p}` },
      update: {
        tenantId: TENANT_ID,
        employeeId: demoEmployeeId,
        type: SsmAccidentType.INCIDENT,
        severity: SsmAccidentSeverity.LOW,
        status: accidentStatuses[i % accidentStatuses.length],
        title: `Caz accident paginare ${p}`,
        occurredAt: scheduledAt,
        location: "Hala test",
        description: "Seed pentru test paginare accidente.",
        legalDaysDeadline: 30,
        dueAt,
        createdBy: CREATED_BY
      },
      create: {
        id: `seed-pag-acc-${p}`,
        tenantId: TENANT_ID,
        employeeId: demoEmployeeId,
        type: SsmAccidentType.INCIDENT,
        severity: SsmAccidentSeverity.LOW,
        status: accidentStatuses[i % accidentStatuses.length],
        title: `Caz accident paginare ${p}`,
        occurredAt: scheduledAt,
        location: "Hala test",
        description: "Seed pentru test paginare accidente.",
        legalDaysDeadline: 30,
        dueAt,
        createdBy: CREATED_BY
      }
    });

    const annStatuses = [
      CommunicationAnnouncementStatus.DRAFT,
      CommunicationAnnouncementStatus.PUBLISHED,
      CommunicationAnnouncementStatus.SCHEDULED
    ] as const;

    await prisma.communicationAnnouncement.upsert({
      where: { id: `seed-pag-ann-${p}` },
      update: {
        tenantId: TENANT_ID,
        title: `Anunț paginare ${p}`,
        body: `Conținut anunț #${p} pentru test paginare.`,
        contentType: CommunicationContentType.TEXT,
        audienceType: CommunicationAudienceType.ALL,
        status: annStatuses[i % annStatuses.length],
        publishAt: i % 3 === 1 ? scheduledAt : null,
        createdBy: CREATED_BY
      },
      create: {
        id: `seed-pag-ann-${p}`,
        tenantId: TENANT_ID,
        title: `Anunț paginare ${p}`,
        body: `Conținut anunț #${p} pentru test paginare.`,
        contentType: CommunicationContentType.TEXT,
        audienceType: CommunicationAudienceType.ALL,
        status: annStatuses[i % annStatuses.length],
        publishAt: i % 3 === 1 ? scheduledAt : null,
        createdBy: CREATED_BY
      }
    });

    const surveyStatuses = [SurveyStatus.DRAFT, SurveyStatus.ACTIVE, SurveyStatus.CLOSED] as const;

    await prisma.survey.upsert({
      where: { id: `seed-pag-survey-${p}` },
      update: {
        tenantId: TENANT_ID,
        title: `Sondaj paginare ${p}`,
        description: "Seed paginare",
        status: surveyStatuses[i % surveyStatuses.length],
        audienceType: SurveyAudienceType.ALL,
        questionSchema: SURVEY_QUESTION_SCHEMA,
        createdBy: CREATED_BY
      },
      create: {
        id: `seed-pag-survey-${p}`,
        tenantId: TENANT_ID,
        title: `Sondaj paginare ${p}`,
        description: "Seed paginare",
        status: surveyStatuses[i % surveyStatuses.length],
        audienceType: SurveyAudienceType.ALL,
        questionSchema: SURVEY_QUESTION_SCHEMA,
        createdBy: CREATED_BY
      }
    });

    const ticketStatuses = [
      HelpdeskTicketStatus.OPEN,
      HelpdeskTicketStatus.WAITING_OPERATOR,
      HelpdeskTicketStatus.CLOSED
    ] as const;
    const priorities = [
      HelpdeskTicketPriority.LOW,
      HelpdeskTicketPriority.MEDIUM,
      HelpdeskTicketPriority.HIGH
    ] as const;

    await prisma.helpdeskTicket.upsert({
      where: { id: `seed-pag-ticket-${p}` },
      update: {
        tenantId: TENANT_ID,
        title: `Tichet paginare ${p}`,
        description: `Descriere tichet #${p}`,
        category: "IT",
        status: ticketStatuses[i % ticketStatuses.length],
        priority: priorities[i % priorities.length],
        source: HelpdeskTicketSource.PORTAL,
        reporterEmployeeId: employeeId,
        createdBy: CREATED_BY
      },
      create: {
        id: `seed-pag-ticket-${p}`,
        tenantId: TENANT_ID,
        title: `Tichet paginare ${p}`,
        description: `Descriere tichet #${p}`,
        category: "IT",
        status: ticketStatuses[i % ticketStatuses.length],
        priority: priorities[i % priorities.length],
        source: HelpdeskTicketSource.PORTAL,
        reporterEmployeeId: employeeId,
        createdBy: CREATED_BY
      }
    });

    await prisma.employeeStaticPage.upsert({
      where: { tenantId_slug: { tenantId: TENANT_ID, slug: `pag-test-${p}` } },
      update: {
        title: `Pagină statică ${p}`,
        bodyMarkdown: `## Pagină test ${p}\n\nConținut pentru paginare.`,
        published: i % 2 === 0,
        sortOrder: i,
        createdBy: CREATED_BY
      },
      create: {
        id: `seed-pag-static-${p}`,
        tenantId: TENANT_ID,
        slug: `pag-test-${p}`,
        title: `Pagină statică ${p}`,
        bodyMarkdown: `## Pagină test ${p}\n\nConținut pentru paginare.`,
        published: i % 2 === 0,
        sortOrder: i,
        createdBy: CREATED_BY
      }
    });

    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: TENANT_ID, email: `paginare.user.${p}@company.local` } },
      update: {
        fullName: `Utilizator paginare ${p}`,
        active: true,
        roles: [SystemRole.EMPLOYEE],
        passwordHash
      },
      create: {
        id: `seed-pag-user-${p}`,
        tenantId: TENANT_ID,
        email: `paginare.user.${p}@company.local`,
        fullName: `Utilizator paginare ${p}`,
        active: true,
        roles: [SystemRole.EMPLOYEE],
        passwordHash
      }
    });
  }

  console.log(`[pagination-seed] Gata. ~${COUNT} rânduri per: worksite, departament, post, angajat, plan, document, accident, anunț, sondaj, tichet, pagină statică, utilizator.`);
  console.log("[pagination-seed] Login admin: admin@company.local / parola din SEED_ADMIN_PASSWORD (implicit ChangeMe123!)");
  console.log(`[pagination-seed] Test UI: tenant ${TENANT_ID}, pageSize 25 → ~${Math.ceil(COUNT / 25)} pagini.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
