import { PrismaClient, SsmAccidentCaseStatus, SsmAccidentSeverity, SsmAccidentType, SsmEipMovementType, SsmTrainingPlanStatus } from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_ID = "e01";
const CREATED_BY = "seed-test-data";

async function ensureEmployee(id: string, fullName: string, email: string, refs: { worksiteId?: string; departmentId?: string; jobPositionId?: string }) {
  return prisma.employee.upsert({
    where: { id },
    update: {
      tenantId: TENANT_ID,
      fullName,
      email,
      active: true,
      worksiteId: refs.worksiteId ?? null,
      departmentId: refs.departmentId ?? null,
      jobPositionId: refs.jobPositionId ?? null
    },
    create: {
      id,
      tenantId: TENANT_ID,
      fullName,
      email,
      active: true,
      worksiteId: refs.worksiteId ?? null,
      departmentId: refs.departmentId ?? null,
      jobPositionId: refs.jobPositionId ?? null
    }
  });
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
  if (!tenant) {
    throw new Error(`Tenant ${TENANT_ID} not found. Run prisma seed first.`);
  }

  const worksite = await prisma.worksite.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "PLANT-01" } },
    update: { name: "Punct de lucru fabrica", active: true },
    create: { tenantId: TENANT_ID, code: "PLANT-01", name: "Punct de lucru fabrica", active: true }
  });

  const department = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "PROD" } },
    update: { name: "Productie", active: true, worksiteId: worksite.id },
    create: {
      tenantId: TENANT_ID,
      code: "PROD",
      name: "Productie",
      active: true,
      worksiteId: worksite.id
    }
  });

  const job = await prisma.jobPosition.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "OP-LINIE" } },
    update: { name: "Operator linie", active: true, departmentId: department.id, corCode: "9329" },
    create: {
      tenantId: TENANT_ID,
      code: "OP-LINIE",
      name: "Operator linie",
      departmentId: department.id,
      corCode: "9329",
      active: true
    }
  });

  const employees = await Promise.all([
    ensureEmployee("seed-demo-employee-e01", "Ion Popescu (demo SSM)", "ion.popescu.demo@company.local", {
      worksiteId: worksite.id,
      departmentId: department.id,
      jobPositionId: job.id
    }),
    ensureEmployee("seed-test-employee-e01-2", "Maria Ionescu", "maria.ionescu@company.local", {
      worksiteId: worksite.id,
      departmentId: department.id,
      jobPositionId: job.id
    }),
    ensureEmployee("seed-test-employee-e01-3", "Andrei Georgescu", "andrei.georgescu@company.local", {
      worksiteId: worksite.id,
      departmentId: department.id,
      jobPositionId: job.id
    })
  ]);

  const introType = await prisma.ssmTrainingType.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "SSM-INTRO-2026" } },
    update: { name: "Instruire introductiv-generala 2026", recurrenceDays: 365, reminderDays: [30, 15, 7], active: true },
    create: {
      tenantId: TENANT_ID,
      code: "SSM-INTRO-2026",
      name: "Instruire introductiv-generala 2026",
      recurrenceDays: 365,
      reminderDays: [30, 15, 7],
      active: true
    }
  });

  const psiType = await prisma.ssmTrainingType.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "PSI-URG-2026" } },
    update: { name: "Instruire PSI / urgenta 2026", recurrenceDays: 180, reminderDays: [30, 15, 7], active: true },
    create: {
      tenantId: TENANT_ID,
      code: "PSI-URG-2026",
      name: "Instruire PSI / urgenta 2026",
      recurrenceDays: 180,
      reminderDays: [30, 15, 7],
      active: true
    }
  });

  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  const planCompleted = await prisma.ssmTrainingPlan.upsert({
    where: { id: "seed-training-plan-completed-e01" },
    update: {
      tenantId: TENANT_ID,
      employeeId: employees[0].id,
      trainingTypeId: introType.id,
      scheduledAt: new Date(now.getTime() - 15 * oneDay),
      dueAt: new Date(now.getTime() - 10 * oneDay),
      completedAt: new Date(now.getTime() - 9 * oneDay),
      score: 92,
      durationMinutes: 540,
      status: SsmTrainingPlanStatus.COMPLETED,
      blockedAdmission: false,
      createdBy: CREATED_BY
    },
    create: {
      id: "seed-training-plan-completed-e01",
      tenantId: TENANT_ID,
      employeeId: employees[0].id,
      trainingTypeId: introType.id,
      scheduledAt: new Date(now.getTime() - 15 * oneDay),
      dueAt: new Date(now.getTime() - 10 * oneDay),
      completedAt: new Date(now.getTime() - 9 * oneDay),
      score: 92,
      durationMinutes: 540,
      status: SsmTrainingPlanStatus.COMPLETED,
      blockedAdmission: false,
      createdBy: CREATED_BY
    }
  });

  const planPending = await prisma.ssmTrainingPlan.upsert({
    where: { id: "seed-training-plan-pending-e01" },
    update: {
      tenantId: TENANT_ID,
      employeeId: employees[1].id,
      trainingTypeId: psiType.id,
      scheduledAt: new Date(now.getTime() + 2 * oneDay),
      dueAt: new Date(now.getTime() + 20 * oneDay),
      completedAt: null,
      score: null,
      durationMinutes: null,
      status: SsmTrainingPlanStatus.PENDING,
      blockedAdmission: false,
      createdBy: CREATED_BY
    },
    create: {
      id: "seed-training-plan-pending-e01",
      tenantId: TENANT_ID,
      employeeId: employees[1].id,
      trainingTypeId: psiType.id,
      scheduledAt: new Date(now.getTime() + 2 * oneDay),
      dueAt: new Date(now.getTime() + 20 * oneDay),
      status: SsmTrainingPlanStatus.PENDING,
      blockedAdmission: false,
      createdBy: CREATED_BY
    }
  });

  const planOverdue = await prisma.ssmTrainingPlan.upsert({
    where: { id: "seed-training-plan-overdue-e01" },
    update: {
      tenantId: TENANT_ID,
      employeeId: employees[2].id,
      trainingTypeId: introType.id,
      scheduledAt: new Date(now.getTime() - 30 * oneDay),
      dueAt: new Date(now.getTime() - 2 * oneDay),
      completedAt: null,
      score: null,
      durationMinutes: null,
      status: SsmTrainingPlanStatus.OVERDUE,
      blockedAdmission: true,
      createdBy: CREATED_BY
    },
    create: {
      id: "seed-training-plan-overdue-e01",
      tenantId: TENANT_ID,
      employeeId: employees[2].id,
      trainingTypeId: introType.id,
      scheduledAt: new Date(now.getTime() - 30 * oneDay),
      dueAt: new Date(now.getTime() - 2 * oneDay),
      status: SsmTrainingPlanStatus.OVERDUE,
      blockedAdmission: true,
      createdBy: CREATED_BY
    }
  });

  await prisma.ssmTrainingTestAttempt.upsert({
    where: { id: "seed-training-attempt-e01-1" },
    update: {
      tenantId: TENANT_ID,
      trainingPlanId: planCompleted.id,
      startedAt: new Date(now.getTime() - 10 * oneDay),
      finishedAt: new Date(now.getTime() - 9 * oneDay),
      score: 92,
      durationSeconds: 540 * 60,
      passed: true
    },
    create: {
      id: "seed-training-attempt-e01-1",
      tenantId: TENANT_ID,
      trainingPlanId: planCompleted.id,
      startedAt: new Date(now.getTime() - 10 * oneDay),
      finishedAt: new Date(now.getTime() - 9 * oneDay),
      score: 92,
      durationSeconds: 540 * 60,
      passed: true
    }
  });

  await prisma.ssmTrainingSignature.upsert({
    where: { trainingPlanId: planCompleted.id },
    update: {
      tenantId: TENANT_ID,
      employeeSignature: "seed-signature-employee",
      responsibleSignature: "seed-signature-responsible",
      employeeSignedAt: new Date(now.getTime() - 9 * oneDay),
      responsibleSignedAt: new Date(now.getTime() - 8 * oneDay)
    },
    create: {
      tenantId: TENANT_ID,
      trainingPlanId: planCompleted.id,
      employeeSignature: "seed-signature-employee",
      responsibleSignature: "seed-signature-responsible",
      employeeSignedAt: new Date(now.getTime() - 9 * oneDay),
      responsibleSignedAt: new Date(now.getTime() - 8 * oneDay)
    }
  });

  const eipType = await prisma.ssmEipType.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "CASCA" } },
    update: { name: "Casca protectie", defaultLifetimeDays: 365, active: true },
    create: {
      tenantId: TENANT_ID,
      code: "CASCA",
      name: "Casca protectie",
      defaultLifetimeDays: 365,
      active: true
    }
  });

  await prisma.ssmEipNorm.upsert({
    where: { jobPositionId_eipTypeId: { jobPositionId: job.id, eipTypeId: eipType.id } },
    update: { requiredQuantity: 1, lifetimeDays: 365, replacementRule: "La uzura sau la 12 luni" },
    create: {
      tenantId: TENANT_ID,
      jobPositionId: job.id,
      eipTypeId: eipType.id,
      requiredQuantity: 1,
      lifetimeDays: 365,
      replacementRule: "La uzura sau la 12 luni",
      createdBy: CREATED_BY
    }
  });

  const stock = await prisma.ssmEipStock.upsert({
    where: { tenantId_eipTypeId: { tenantId: TENANT_ID, eipTypeId: eipType.id } },
    update: { quantityOnHand: 50, minimumThreshold: 10 },
    create: {
      tenantId: TENANT_ID,
      eipTypeId: eipType.id,
      quantityOnHand: 50,
      minimumThreshold: 10
    }
  });

  await prisma.ssmEipMovement.upsert({
    where: { id: "seed-eip-movement-e01-1" },
    update: {
      tenantId: TENANT_ID,
      employeeId: employees[0].id,
      eipTypeId: eipType.id,
      movementType: SsmEipMovementType.DISTRIBUTION,
      quantity: 1,
      replacementDueAt: new Date(now.getTime() + 365 * oneDay),
      signatureData: "Semnatura primire seed",
      signedAt: now,
      notes: "Distribuire inițială",
      createdBy: CREATED_BY
    },
    create: {
      id: "seed-eip-movement-e01-1",
      tenantId: TENANT_ID,
      employeeId: employees[0].id,
      eipTypeId: eipType.id,
      movementType: SsmEipMovementType.DISTRIBUTION,
      quantity: 1,
      replacementDueAt: new Date(now.getTime() + 365 * oneDay),
      signatureData: "Semnatura primire seed",
      signedAt: now,
      notes: "Distribuire inițială",
      createdBy: CREATED_BY
    }
  });

  await prisma.ssmEipStock.update({
    where: { id: stock.id },
    data: { quantityOnHand: 49 }
  });

  await prisma.ssmAccidentCase.upsert({
    where: { id: "seed-accident-case-e01-1" },
    update: {
      tenantId: TENANT_ID,
      employeeId: employees[1].id,
      type: SsmAccidentType.INCIDENT,
      severity: SsmAccidentSeverity.MEDIUM,
      status: SsmAccidentCaseStatus.IN_RESEARCH,
      title: "Near-miss la linia de producție",
      occurredAt: new Date(now.getTime() - 2 * oneDay),
      location: "Hala principală",
      description: "Operatorul a evitat un accident prin oprire de urgență.",
      legalDaysDeadline: 30,
      dueAt: new Date(now.getTime() + 28 * oneDay),
      createdBy: CREATED_BY
    },
    create: {
      id: "seed-accident-case-e01-1",
      tenantId: TENANT_ID,
      employeeId: employees[1].id,
      type: SsmAccidentType.INCIDENT,
      severity: SsmAccidentSeverity.MEDIUM,
      status: SsmAccidentCaseStatus.IN_RESEARCH,
      title: "Near-miss la linia de producție",
      occurredAt: new Date(now.getTime() - 2 * oneDay),
      location: "Hala principală",
      description: "Operatorul a evitat un accident prin oprire de urgență.",
      legalDaysDeadline: 30,
      dueAt: new Date(now.getTime() + 28 * oneDay),
      createdBy: CREATED_BY
    }
  });

  await prisma.ssmAccidentTask.upsert({
    where: { id: "seed-accident-task-e01-1" },
    update: {
      tenantId: TENANT_ID,
      accidentCaseId: "seed-accident-case-e01-1",
      title: "Colectare declaratii martori",
      assignedTo: "Responsabil SSM",
      dueAt: new Date(now.getTime() + 2 * oneDay),
      notes: "Interviu echipă tură",
      createdBy: CREATED_BY
    },
    create: {
      id: "seed-accident-task-e01-1",
      tenantId: TENANT_ID,
      accidentCaseId: "seed-accident-case-e01-1",
      title: "Colectare declaratii martori",
      assignedTo: "Responsabil SSM",
      dueAt: new Date(now.getTime() + 2 * oneDay),
      notes: "Interviu echipă tură",
      createdBy: CREATED_BY
    }
  });

  console.log("Seed test data OK for tenant e01.");
  console.log("Employees:", employees.map((e) => `${e.fullName} (${e.id})`).join(", "));
  console.log("Training plans:", [planCompleted.id, planPending.id, planOverdue.id].join(", "));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
