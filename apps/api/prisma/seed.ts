import { PrismaClient } from "@prisma/client";
import { SystemRole } from "../src/common/prisma-enums";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordPlain = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(passwordPlain, 12);

  for (let i = 1; i <= 14; i += 1) {
    const id = `e${String(i).padStart(2, "0")}`;
    const name = `Entitate juridică ${String(i).padStart(2, "0")}`;
    await prisma.tenant.upsert({
      where: { id },
      update: { name, active: true },
      create: { id, name, active: true }
    });
  }

  const primaryTenantId = "e01";

  await prisma.worksite.upsert({
    where: { tenantId_code: { tenantId: primaryTenantId, code: "HQ" } },
    update: { name: "Sediu central", active: true },
    create: { tenantId: primaryTenantId, code: "HQ", name: "Sediu central", active: true }
  });

  const dep = await prisma.department.upsert({
    where: { tenantId_code: { tenantId: primaryTenantId, code: "ADMIN" } },
    update: { name: "Administrație", active: true },
    create: {
      tenantId: primaryTenantId,
      code: "ADMIN",
      name: "Administrație",
      active: true
    }
  });

  const job = await prisma.jobPosition.upsert({
    where: { tenantId_code: { tenantId: primaryTenantId, code: "MGR" } },
    update: { name: "Manager", active: true, corCode: "1219", departmentId: dep.id },
    create: {
      tenantId: primaryTenantId,
      departmentId: dep.id,
      code: "MGR",
      name: "Manager",
      corCode: "1219",
      active: true
    }
  });

  const email = "admin@company.local";

  await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: primaryTenantId, email }
    },
    update: {
      passwordHash,
      active: true,
      fullName: "Administrator seed",
      roles: [SystemRole.SSM_ADMIN]
    },
    create: {
      tenantId: primaryTenantId,
      email,
      passwordHash,
      fullName: "Administrator seed",
      active: true,
      roles: [SystemRole.SSM_ADMIN]
    }
  });

  const worksiteRow = await prisma.worksite.findUnique({
    where: { tenantId_code: { tenantId: primaryTenantId, code: "HQ" } },
    select: { id: true }
  });
  const demoEmployeeId = "seed-demo-employee-e01";
  const demoEmail = "ion.popescu.demo@company.local";
  await prisma.employee.upsert({
    where: { id: demoEmployeeId },
    update: {
      tenantId: primaryTenantId,
      fullName: "Ion Popescu (demo SSM)",
      email: demoEmail,
      active: true,
      worksiteId: worksiteRow?.id ?? null,
      departmentId: dep.id,
      jobPositionId: job.id
    },
    create: {
      id: demoEmployeeId,
      tenantId: primaryTenantId,
      fullName: "Ion Popescu (demo SSM)",
      email: demoEmail,
      active: true,
      worksiteId: worksiteRow?.id ?? null,
      departmentId: dep.id,
      jobPositionId: job.id
    }
  });

  console.log("Seed OK: 14 tenants (e01–e14), admin user on e01:", email);
  console.log("Default password (change in production):", passwordPlain);
  console.log("Demo employee ID (tenant e01, for Assign training):", demoEmployeeId);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
