import {
  type Employee,
  PrismaClient,
  SsmAccidentCaseStatus,
  SsmAccidentSeverity,
  SsmAccidentType,
  SsmEipMovementType,
  SsmMedicalControlResult,
  SsmTrainingCategory,
  SsmTrainingPlanStatus
} from "@prisma/client";

const prisma = new PrismaClient();
declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};

const TENANT_ID = process.env.TEST_SEED_TENANT_ID ?? "e01";
const CREATED_BY = "seed-test-data-extended";
const DEMO_EMPLOYEE_ID = process.env.VITE_DEMO_EMPLOYEE_ID ?? "seed-demo-employee-e01";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const EMPLOYEE_COUNT = envInt("TEST_SEED_EMPLOYEE_COUNT", 40);
const TRAINING_PLANS_PER_EMPLOYEE = envInt("TEST_SEED_TRAINING_PLANS_PER_EMPLOYEE", 3);
const EIP_MOVEMENT_COUNT = envInt("TEST_SEED_EIP_MOVEMENT_COUNT", 80);
const ACCIDENT_CASE_COUNT = envInt("TEST_SEED_ACCIDENT_CASE_COUNT", 20);
const MEDICAL_CONTROL_COUNT = envInt("TEST_SEED_MEDICAL_CONTROL_COUNT", 50);

const DAY_MS = 24 * 60 * 60 * 1000;

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

  const worksiteHq = await prisma.worksite.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "HQ" } },
    update: { name: "Sediu central", active: true },
    create: { tenantId: TENANT_ID, code: "HQ", name: "Sediu central", active: true }
  });
  const worksitePlant = await prisma.worksite.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "PLANT-01" } },
    update: { name: "Punct de lucru fabrica", active: true },
    create: { tenantId: TENANT_ID, code: "PLANT-01", name: "Punct de lucru fabrica", active: true }
  });

  const depAdmin = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "ADMIN" } },
    update: { name: "Administrativ", active: true, worksiteId: worksiteHq.id },
    create: { tenantId: TENANT_ID, code: "ADMIN", name: "Administrativ", active: true, worksiteId: worksiteHq.id }
  });
  const depProd = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "PROD" } },
    update: { name: "Productie", active: true, worksiteId: worksitePlant.id },
    create: { tenantId: TENANT_ID, code: "PROD", name: "Productie", active: true, worksiteId: worksitePlant.id }
  });
  const depLog = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "LOG" } },
    update: { name: "Logistica", active: true, worksiteId: worksitePlant.id },
    create: { tenantId: TENANT_ID, code: "LOG", name: "Logistica", active: true, worksiteId: worksitePlant.id }
  });

  const jobMgr = await prisma.jobPosition.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "MGR" } },
    update: { name: "Manager", active: true, corCode: "1219", departmentId: depAdmin.id },
    create: {
      tenantId: TENANT_ID,
      code: "MGR",
      name: "Manager",
      corCode: "1219",
      active: true,
      departmentId: depAdmin.id
    }
  });
  const jobOperator = await prisma.jobPosition.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "OP-LINIE" } },
    update: { name: "Operator linie", active: true, corCode: "9329", departmentId: depProd.id },
    create: {
      tenantId: TENANT_ID,
      code: "OP-LINIE",
      name: "Operator linie",
      corCode: "9329",
      active: true,
      departmentId: depProd.id
    }
  });
  const jobTech = await prisma.jobPosition.upsert({
    where: { tenantId_code: { tenantId: TENANT_ID, code: "TEH-MNT" } },
    update: { name: "Tehnician mentenanta", active: true, corCode: "3115", departmentId: depLog.id },
    create: {
      tenantId: TENANT_ID,
      code: "TEH-MNT",
      name: "Tehnician mentenanta",
      corCode: "3115",
      active: true,
      departmentId: depLog.id
    }
  });

  const employees: Employee[] = [];
  for (let i = 0; i < EMPLOYEE_COUNT; i += 1) {
    const n = i + 1;
    const padded = String(n).padStart(3, "0");
    const id = i === 0 ? DEMO_EMPLOYEE_ID : `seed-ext-employee-${TENANT_ID}-${padded}`;
    const fullName = i === 0 ? "Ion Popescu (demo SSM)" : `Angajat test ${padded}`;
    const email = i === 0 ? "ion.popescu.demo@company.local" : `angajat.test.${padded}@company.local`;
    const department = i % 3 === 0 ? depAdmin : i % 3 === 1 ? depProd : depLog;
    const job = i % 3 === 0 ? jobMgr : i % 3 === 1 ? jobOperator : jobTech;
    const worksiteId = department.id === depAdmin.id ? worksiteHq.id : worksitePlant.id;

    const employee = await ensureEmployee(id, fullName, email, {
      worksiteId,
      departmentId: department.id,
      jobPositionId: job.id
    });
    employees.push(employee);
  }

  const trainingTypes = [
    await prisma.ssmTrainingType.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code: "SSM-INTRO-EXT" } },
      update: {
        name: "Instruire introductiva extinsa",
        category: SsmTrainingCategory.INTRODUCTORY_GENERAL,
        legalMinDurationHours: 8,
        recurrenceDays: 365,
        reminderDays: [30, 15, 7],
        active: true
      },
      create: {
        tenantId: TENANT_ID,
        code: "SSM-INTRO-EXT",
        name: "Instruire introductiva extinsa",
        category: SsmTrainingCategory.INTRODUCTORY_GENERAL,
        legalMinDurationHours: 8,
        recurrenceDays: 365,
        reminderDays: [30, 15, 7],
        active: true
      }
    }),
    await prisma.ssmTrainingType.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code: "SSM-PERIODIC-EXT" } },
      update: {
        name: "Instruire periodica extinsa",
        category: SsmTrainingCategory.PERIODIC,
        legalMinDurationHours: 2,
        recurrenceDays: 180,
        reminderDays: [30, 15, 7],
        active: true
      },
      create: {
        tenantId: TENANT_ID,
        code: "SSM-PERIODIC-EXT",
        name: "Instruire periodica extinsa",
        category: SsmTrainingCategory.PERIODIC,
        legalMinDurationHours: 2,
        recurrenceDays: 180,
        reminderDays: [30, 15, 7],
        active: true
      }
    }),
    await prisma.ssmTrainingType.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code: "PSI-EXT" } },
      update: {
        name: "Instruire PSI extinsa",
        category: SsmTrainingCategory.EMERGENCY_PSI,
        legalMinDurationHours: 2,
        recurrenceDays: 180,
        reminderDays: [30, 15, 7],
        active: true
      },
      create: {
        tenantId: TENANT_ID,
        code: "PSI-EXT",
        name: "Instruire PSI extinsa",
        category: SsmTrainingCategory.EMERGENCY_PSI,
        legalMinDurationHours: 2,
        recurrenceDays: 180,
        reminderDays: [30, 15, 7],
        active: true
      }
    })
  ];

  const statuses = [SsmTrainingPlanStatus.COMPLETED, SsmTrainingPlanStatus.PENDING, SsmTrainingPlanStatus.OVERDUE] as const;
  const now = Date.now();

  for (let i = 0; i < employees.length; i += 1) {
    for (let j = 0; j < TRAINING_PLANS_PER_EMPLOYEE; j += 1) {
      const status = statuses[(i + j) % statuses.length];
      const trainingType = trainingTypes[j % trainingTypes.length];
      const scheduledAt = new Date(now - (20 + i + j) * DAY_MS);
      const dueAt = status === SsmTrainingPlanStatus.OVERDUE ? new Date(now - (1 + (i % 7)) * DAY_MS) : new Date(now + (7 + i + j) * DAY_MS);
      const completedAt = status === SsmTrainingPlanStatus.COMPLETED ? new Date(now - (2 + (i % 5)) * DAY_MS) : null;
      const planId = `seed-ext-training-plan-${i + 1}-${j + 1}`;

      const plan = await prisma.ssmTrainingPlan.upsert({
        where: { id: planId },
        update: {
          tenantId: TENANT_ID,
          employeeId: employees[i].id,
          trainingTypeId: trainingType.id,
          scheduledAt,
          dueAt,
          completedAt,
          score: status === SsmTrainingPlanStatus.COMPLETED ? 75 + ((i + j) % 25) : null,
          durationMinutes: status === SsmTrainingPlanStatus.COMPLETED ? 60 + ((i + j) % 120) : null,
          status,
          blockedAdmission: status === SsmTrainingPlanStatus.OVERDUE,
          createdBy: CREATED_BY
        },
        create: {
          id: planId,
          tenantId: TENANT_ID,
          employeeId: employees[i].id,
          trainingTypeId: trainingType.id,
          scheduledAt,
          dueAt,
          completedAt,
          score: status === SsmTrainingPlanStatus.COMPLETED ? 75 + ((i + j) % 25) : null,
          durationMinutes: status === SsmTrainingPlanStatus.COMPLETED ? 60 + ((i + j) % 120) : null,
          status,
          blockedAdmission: status === SsmTrainingPlanStatus.OVERDUE,
          createdBy: CREATED_BY
        }
      });

      if (status === SsmTrainingPlanStatus.COMPLETED) {
        const attemptId = `seed-ext-test-attempt-${i + 1}-${j + 1}`;
        await prisma.ssmTrainingTestAttempt.upsert({
          where: { id: attemptId },
          update: {
            tenantId: TENANT_ID,
            trainingPlanId: plan.id,
            startedAt: new Date(now - (3 + i + j) * DAY_MS),
            finishedAt: new Date(now - (2 + i + j) * DAY_MS),
            score: 75 + ((i + j) % 25),
            durationSeconds: 3600 + ((i + j) % 1800),
            passed: true
          },
          create: {
            id: attemptId,
            tenantId: TENANT_ID,
            trainingPlanId: plan.id,
            startedAt: new Date(now - (3 + i + j) * DAY_MS),
            finishedAt: new Date(now - (2 + i + j) * DAY_MS),
            score: 75 + ((i + j) % 25),
            durationSeconds: 3600 + ((i + j) % 1800),
            passed: true
          }
        });

        await prisma.ssmTrainingSignature.upsert({
          where: { trainingPlanId: plan.id },
          update: {
            tenantId: TENANT_ID,
            employeeSignature: `employee-sign-${i + 1}-${j + 1}`,
            responsibleSignature: "responsible-sign-seed",
            employeeSignedAt: new Date(now - (2 + i + j) * DAY_MS),
            responsibleSignedAt: new Date(now - (1 + i + j) * DAY_MS)
          },
          create: {
            tenantId: TENANT_ID,
            trainingPlanId: plan.id,
            employeeSignature: `employee-sign-${i + 1}-${j + 1}`,
            responsibleSignature: "responsible-sign-seed",
            employeeSignedAt: new Date(now - (2 + i + j) * DAY_MS),
            responsibleSignedAt: new Date(now - (1 + i + j) * DAY_MS)
          }
        });
      }
    }
  }

  const eipTypes = [
    await prisma.ssmEipType.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code: "CASCA" } },
      update: { name: "Casca protectie", defaultLifetimeDays: 365, active: true },
      create: { tenantId: TENANT_ID, code: "CASCA", name: "Casca protectie", defaultLifetimeDays: 365, active: true }
    }),
    await prisma.ssmEipType.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code: "VESTA" } },
      update: { name: "Vesta reflectorizanta", defaultLifetimeDays: 180, active: true },
      create: { tenantId: TENANT_ID, code: "VESTA", name: "Vesta reflectorizanta", defaultLifetimeDays: 180, active: true }
    }),
    await prisma.ssmEipType.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code: "BOCANCI" } },
      update: { name: "Bocanci protectie", defaultLifetimeDays: 365, active: true },
      create: { tenantId: TENANT_ID, code: "BOCANCI", name: "Bocanci protectie", defaultLifetimeDays: 365, active: true }
    })
  ];

  const jobs = [jobMgr, jobOperator, jobTech];
  for (const job of jobs) {
    for (let i = 0; i < eipTypes.length; i += 1) {
      const eipType = eipTypes[i];
      await prisma.ssmEipNorm.upsert({
        where: { jobPositionId_eipTypeId: { jobPositionId: job.id, eipTypeId: eipType.id } },
        update: {
          requiredQuantity: job.id === jobMgr.id ? 1 : 2,
          lifetimeDays: eipType.defaultLifetimeDays ?? 365,
          replacementRule: "Inlocuire la scadenta sau uzura"
        },
        create: {
          tenantId: TENANT_ID,
          jobPositionId: job.id,
          eipTypeId: eipType.id,
          requiredQuantity: job.id === jobMgr.id ? 1 : 2,
          lifetimeDays: eipType.defaultLifetimeDays ?? 365,
          replacementRule: "Inlocuire la scadenta sau uzura",
          createdBy: CREATED_BY
        }
      });
    }
  }

  for (const eipType of eipTypes) {
    await prisma.ssmEipStock.upsert({
      where: { tenantId_eipTypeId: { tenantId: TENANT_ID, eipTypeId: eipType.id } },
      update: { quantityOnHand: 300, minimumThreshold: 40 },
      create: { tenantId: TENANT_ID, eipTypeId: eipType.id, quantityOnHand: 300, minimumThreshold: 40 }
    });
  }

  const movementTypes = [SsmEipMovementType.DISTRIBUTION, SsmEipMovementType.RETURN, SsmEipMovementType.SCRAP] as const;
  for (let i = 0; i < EIP_MOVEMENT_COUNT; i += 1) {
    const movementType = movementTypes[i % movementTypes.length];
    const employee = employees[i % employees.length];
    const eipType = eipTypes[i % eipTypes.length];
    const isDistribution = movementType === SsmEipMovementType.DISTRIBUTION;

    await prisma.ssmEipMovement.upsert({
      where: { id: `seed-ext-eip-movement-${i + 1}` },
      update: {
        tenantId: TENANT_ID,
        employeeId: employee.id,
        eipTypeId: eipType.id,
        movementType,
        quantity: 1 + (i % 2),
        movementDate: new Date(now - (i % 60) * DAY_MS),
        replacementDueAt: isDistribution ? new Date(now + (90 + (i % 120)) * DAY_MS) : null,
        signatureData: "seed-signature",
        signedAt: new Date(now - (i % 60) * DAY_MS),
        notes: `Seed movement ${i + 1}`,
        createdBy: CREATED_BY
      },
      create: {
        id: `seed-ext-eip-movement-${i + 1}`,
        tenantId: TENANT_ID,
        employeeId: employee.id,
        eipTypeId: eipType.id,
        movementType,
        quantity: 1 + (i % 2),
        movementDate: new Date(now - (i % 60) * DAY_MS),
        replacementDueAt: isDistribution ? new Date(now + (90 + (i % 120)) * DAY_MS) : null,
        signatureData: "seed-signature",
        signedAt: new Date(now - (i % 60) * DAY_MS),
        notes: `Seed movement ${i + 1}`,
        createdBy: CREATED_BY
      }
    });
  }

  const accidentTypes = [SsmAccidentType.ACCIDENT, SsmAccidentType.INCIDENT, SsmAccidentType.OCCUPATIONAL_DISEASE] as const;
  const accidentSeverities = [SsmAccidentSeverity.LOW, SsmAccidentSeverity.MEDIUM, SsmAccidentSeverity.HIGH, SsmAccidentSeverity.CRITICAL] as const;
  const accidentStatuses = [SsmAccidentCaseStatus.OPEN, SsmAccidentCaseStatus.IN_RESEARCH, SsmAccidentCaseStatus.MEASURES_DEFINED, SsmAccidentCaseStatus.CLOSED] as const;

  for (let i = 0; i < ACCIDENT_CASE_COUNT; i += 1) {
    const status = accidentStatuses[i % accidentStatuses.length];
    const caseId = `seed-ext-accident-case-${i + 1}`;

    await prisma.ssmAccidentCase.upsert({
      where: { id: caseId },
      update: {
        tenantId: TENANT_ID,
        employeeId: employees[i % employees.length].id,
        type: accidentTypes[i % accidentTypes.length],
        severity: accidentSeverities[i % accidentSeverities.length],
        status,
        title: `Caz test #${i + 1}`,
        occurredAt: new Date(now - (2 + i) * DAY_MS),
        location: i % 2 === 0 ? "Hala productie" : "Depozit",
        description: "Descriere automata pentru testare flux accidente.",
        conclusions: status === SsmAccidentCaseStatus.CLOSED ? "Cauza identificata si tratata." : null,
        correctiveMeasures: status === SsmAccidentCaseStatus.CLOSED ? "Instruire suplimentara si marcaje noi." : null,
        legalDaysDeadline: 30,
        dueAt: new Date(now + (10 + i) * DAY_MS),
        closedAt: status === SsmAccidentCaseStatus.CLOSED ? new Date(now - (i % 5) * DAY_MS) : null,
        createdBy: CREATED_BY
      },
      create: {
        id: caseId,
        tenantId: TENANT_ID,
        employeeId: employees[i % employees.length].id,
        type: accidentTypes[i % accidentTypes.length],
        severity: accidentSeverities[i % accidentSeverities.length],
        status,
        title: `Caz test #${i + 1}`,
        occurredAt: new Date(now - (2 + i) * DAY_MS),
        location: i % 2 === 0 ? "Hala productie" : "Depozit",
        description: "Descriere automata pentru testare flux accidente.",
        conclusions: status === SsmAccidentCaseStatus.CLOSED ? "Cauza identificata si tratata." : null,
        correctiveMeasures: status === SsmAccidentCaseStatus.CLOSED ? "Instruire suplimentara si marcaje noi." : null,
        legalDaysDeadline: 30,
        dueAt: new Date(now + (10 + i) * DAY_MS),
        closedAt: status === SsmAccidentCaseStatus.CLOSED ? new Date(now - (i % 5) * DAY_MS) : null,
        createdBy: CREATED_BY
      }
    });

    for (let t = 0; t < 2; t += 1) {
      const completed = (i + t) % 3 === 0;
      await prisma.ssmAccidentTask.upsert({
        where: { id: `seed-ext-accident-task-${i + 1}-${t + 1}` },
        update: {
          tenantId: TENANT_ID,
          accidentCaseId: caseId,
          title: t === 0 ? "Colectare dovezi" : "Plan masuri corective",
          assignedTo: t === 0 ? "Responsabil SSM" : "Manager departament",
          dueAt: new Date(now + (3 + i + t) * DAY_MS),
          completedAt: completed ? new Date(now - (i % 4) * DAY_MS) : null,
          notes: "Task generat automat pentru test.",
          createdBy: CREATED_BY
        },
        create: {
          id: `seed-ext-accident-task-${i + 1}-${t + 1}`,
          tenantId: TENANT_ID,
          accidentCaseId: caseId,
          title: t === 0 ? "Colectare dovezi" : "Plan masuri corective",
          assignedTo: t === 0 ? "Responsabil SSM" : "Manager departament",
          dueAt: new Date(now + (3 + i + t) * DAY_MS),
          completedAt: completed ? new Date(now - (i % 4) * DAY_MS) : null,
          notes: "Task generat automat pentru test.",
          createdBy: CREATED_BY
        }
      });
    }
  }

  const medicalControlTypes = [
    await prisma.ssmMedicalControlType.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code: "MED-HIRE" } },
      update: { name: "Control la angajare", jobPositionId: null, recurrenceDays: null, reminderDays: [30, 15, 7], active: true, createdBy: CREATED_BY },
      create: {
        tenantId: TENANT_ID,
        code: "MED-HIRE",
        name: "Control la angajare",
        jobPositionId: null,
        recurrenceDays: null,
        reminderDays: [30, 15, 7],
        active: true,
        createdBy: CREATED_BY
      }
    }),
    await prisma.ssmMedicalControlType.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code: "MED-PERIODIC-OP" } },
      update: { name: "Control periodic operator", jobPositionId: jobOperator.id, recurrenceDays: 365, reminderDays: [30, 15, 7], active: true, createdBy: CREATED_BY },
      create: {
        tenantId: TENANT_ID,
        code: "MED-PERIODIC-OP",
        name: "Control periodic operator",
        jobPositionId: jobOperator.id,
        recurrenceDays: 365,
        reminderDays: [30, 15, 7],
        active: true,
        createdBy: CREATED_BY
      }
    }),
    await prisma.ssmMedicalControlType.upsert({
      where: { tenantId_code: { tenantId: TENANT_ID, code: "MED-RETURN" } },
      update: { name: "Control reluare activitate", jobPositionId: null, recurrenceDays: 180, reminderDays: [30, 15, 7], active: true, createdBy: CREATED_BY },
      create: {
        tenantId: TENANT_ID,
        code: "MED-RETURN",
        name: "Control reluare activitate",
        jobPositionId: null,
        recurrenceDays: 180,
        reminderDays: [30, 15, 7],
        active: true,
        createdBy: CREATED_BY
      }
    })
  ];

  const medicalResults = [
    SsmMedicalControlResult.FIT,
    SsmMedicalControlResult.FIT_CONDITIONAL,
    SsmMedicalControlResult.TEMPORARY_UNFIT,
    SsmMedicalControlResult.UNFIT
  ] as const;

  for (let i = 0; i < MEDICAL_CONTROL_COUNT; i += 1) {
    const controlType = medicalControlTypes[i % medicalControlTypes.length];
    const employee = employees[i % employees.length];
    const result = medicalResults[i % medicalResults.length];
    const performedAt = new Date(now - (2 + i) * DAY_MS);
    const nextDueAt = controlType.recurrenceDays ? new Date(performedAt.getTime() + controlType.recurrenceDays * DAY_MS) : null;

    await prisma.ssmMedicalControl.upsert({
      where: { id: `seed-ext-medical-control-${i + 1}` },
      update: {
        tenantId: TENANT_ID,
        employeeId: employee.id,
        controlTypeId: controlType.id,
        scheduledAt: new Date(now - (3 + i) * DAY_MS),
        performedAt,
        result,
        recommendations: result === SsmMedicalControlResult.FIT ? "Apt pentru activitate." : "Monitorizare medicala recomandata.",
        validityUntil: nextDueAt,
        nextDueAt,
        createdBy: CREATED_BY
      },
      create: {
        id: `seed-ext-medical-control-${i + 1}`,
        tenantId: TENANT_ID,
        employeeId: employee.id,
        controlTypeId: controlType.id,
        scheduledAt: new Date(now - (3 + i) * DAY_MS),
        performedAt,
        result,
        recommendations: result === SsmMedicalControlResult.FIT ? "Apt pentru activitate." : "Monitorizare medicala recomandata.",
        validityUntil: nextDueAt,
        nextDueAt,
        createdBy: CREATED_BY
      }
    });
  }

  console.log("Extended seed complete.");
  console.log(`Tenant: ${TENANT_ID}`);
  console.log(`Employees: ${employees.length}`);
  console.log(`Training plans: ${employees.length * TRAINING_PLANS_PER_EMPLOYEE}`);
  console.log(`EIP movements: ${EIP_MOVEMENT_COUNT}`);
  console.log(`Accident cases: ${ACCIDENT_CASE_COUNT}`);
  console.log(`Medical controls: ${MEDICAL_CONTROL_COUNT}`);
  console.log("You can tune volume with env vars:");
  console.log("TEST_SEED_EMPLOYEE_COUNT, TEST_SEED_TRAINING_PLANS_PER_EMPLOYEE, TEST_SEED_EIP_MOVEMENT_COUNT, TEST_SEED_ACCIDENT_CASE_COUNT, TEST_SEED_MEDICAL_CONTROL_COUNT");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
