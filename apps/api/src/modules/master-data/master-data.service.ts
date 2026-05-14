import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { DataEncryptionService } from "../../infrastructure/security/data-encryption.service";
import { AuditLogService } from "../../infrastructure/logging/audit-log.service";
import { CreateWorksiteDto } from "./dto/create-worksite.dto";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { CreateJobPositionDto } from "./dto/create-job-position.dto";
import { UpdateWorksiteDto } from "./dto/update-worksite.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { UpdateJobPositionDto } from "./dto/update-job-position.dto";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { UpdatePlacementDto } from "./dto/update-placement.dto";
import { CreateEmployeeGroupDto } from "./dto/create-group.dto";
import { CreateSsmResponsibleDto } from "./dto/create-ssm-responsible.dto";

type SsmTrainingCategoryCode =
  | "INTRODUCTORY_GENERAL"
  | "WORKPLACE"
  | "PERIODIC"
  | "SUPPLEMENTARY"
  | "EMERGENCY_PSI";

function parseOptionalDate(value?: string): Date | undefined {
  if (!value || !value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Dată nevalidă: ${value}`);
  }
  return d;
}

function looksEncrypted(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p));
}

function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && c === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function parseBool(value: string | undefined, defaultVal = true): boolean {
  if (value === undefined || value === "") return defaultVal;
  const v = value.toLowerCase();
  if (["false", "0", "no"].includes(v)) return false;
  if (["true", "1", "yes"].includes(v)) return true;
  return defaultVal;
}

@Injectable()
export class MasterDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: DataEncryptionService,
    private readonly auditLog: AuditLogService
  ) {}

  private async ensureTrainingType(
    tenantId: string,
    category: SsmTrainingCategoryCode
  ) {
    const defaults: Record<SsmTrainingCategoryCode, { code: string; name: string; recurrenceDays?: number; legalMinDurationHours?: number }> = {
      INTRODUCTORY_GENERAL: {
        code: "SSM-INTRO",
        name: "Instruire introductiv-generală",
        legalMinDurationHours: 8
      },
      WORKPLACE: {
        code: "SSM-WORKPLACE",
        name: "Instruire la locul de muncă"
      },
      PERIODIC: {
        code: "SSM-PERIODIC",
        name: "Instruire periodică",
        recurrenceDays: 180
      },
      SUPPLEMENTARY: {
        code: "SSM-SUPL",
        name: "Instruire suplimentară",
        legalMinDurationHours: 8
      },
      EMERGENCY_PSI: {
        code: "PSI-EMERGENCY",
        name: "Instruire PSI / situații de urgență",
        recurrenceDays: 180
      }
    };
    const def = defaults[category];
    return this.prisma.ssmTrainingType.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: def.code
        }
      },
      create: {
        tenantId,
        code: def.code,
        name: def.name,
        category,
        recurrenceDays: def.recurrenceDays,
        reminderDays: [30, 15, 7],
        legalMinDurationHours: def.legalMinDurationHours
      },
      update: {
        category,
        recurrenceDays: def.recurrenceDays,
        legalMinDurationHours: def.legalMinDurationHours,
        active: true
      }
    });
  }

  private async autoAssignTrainingPlan(
    tenantId: string,
    actorUserId: string,
    employeeId: string,
    category: SsmTrainingCategoryCode,
    reason: string
  ) {
    const type = await this.ensureTrainingType(tenantId, category);
    const existingOpen = await this.prisma.ssmTrainingPlan.findFirst({
      where: {
        tenantId,
        employeeId,
        trainingTypeId: type.id,
        status: { in: ["PENDING", "OVERDUE"] as const }
      }
    });
    if (existingOpen) {
      return;
    }
    const now = new Date();
    const dueAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.ssmTrainingPlan.create({
      data: {
        tenantId,
        employeeId,
        trainingTypeId: type.id,
        scheduledAt: now,
        dueAt,
        materialTitle: reason,
        createdBy: actorUserId
      }
    });
    await this.auditLog.write({
      tenantId,
      actorId: actorUserId,
      module: "SSM",
      action: "TRAINING_AUTO_ASSIGNED",
      entityType: "SsmTrainingPlan",
      entityId: "-",
      payload: { employeeId, category, reason }
    });
  }

  private maskCnp(stored: string | null, reveal: boolean): string | null {
    if (!stored) return null;
    if (!reveal) return "***";
    if (looksEncrypted(stored)) {
      try {
        return this.encryption.decrypt(stored);
      } catch {
        return "***";
      }
    }
    return stored;
  }

  private encryptCnpIfPlain(plain?: string): string | undefined {
    if (!plain?.trim()) return undefined;
    if (looksEncrypted(plain)) return plain;
    return this.encryption.encrypt(plain.trim());
  }

  // --- Puncte de lucru ---
  listWorksites(tenantId: string) {
    return this.prisma.worksite.findMany({
      where: { tenantId },
      orderBy: { code: "asc" }
    });
  }

  async createWorksite(tenantId: string, dto: CreateWorksiteDto) {
    try {
      return await this.prisma.worksite.create({
        data: {
          tenantId,
          code: dto.code.trim(),
          name: dto.name.trim(),
          address: dto.address?.trim(),
          active: dto.active ?? true
        }
      });
    } catch {
      throw new ConflictException("Codul punctului de lucru există deja pentru acest tenant.");
    }
  }

  async updateWorksite(tenantId: string, id: string, dto: UpdateWorksiteDto) {
    const existing = await this.prisma.worksite.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Punct de lucru negăsit.");

    const data: {
      code?: string;
      name?: string;
      address?: string | null;
      active?: boolean;
    } = {};
    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.address !== undefined) data.address = dto.address.trim() ? dto.address.trim() : null;
    if (dto.active !== undefined) data.active = dto.active;

    if (Object.keys(data).length === 0) return existing;

    try {
      return await this.prisma.worksite.update({ where: { id }, data });
    } catch {
      throw new ConflictException("Codul punctului de lucru există deja pentru acest tenant.");
    }
  }

  // --- Departamente ---
  listDepartments(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId },
      orderBy: { code: "asc" }
    });
  }

  async createDepartment(tenantId: string, dto: CreateDepartmentDto) {
    if (dto.worksiteId) {
      const ws = await this.prisma.worksite.findFirst({
        where: { id: dto.worksiteId, tenantId }
      });
      if (!ws) throw new BadRequestException("worksiteId nevalid pentru acest tenant.");
    }
    try {
      return await this.prisma.department.create({
        data: {
          tenantId,
          code: dto.code.trim(),
          name: dto.name.trim(),
          worksiteId: dto.worksiteId,
          active: dto.active ?? true
        }
      });
    } catch {
      throw new ConflictException("Codul departamentului există deja pentru acest tenant.");
    }
  }

  async updateDepartment(tenantId: string, id: string, dto: UpdateDepartmentDto) {
    const existing = await this.prisma.department.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Departament negăsit.");

    if (dto.worksiteId !== undefined && dto.worksiteId.trim()) {
      const ws = await this.prisma.worksite.findFirst({
        where: { id: dto.worksiteId.trim(), tenantId }
      });
      if (!ws) throw new BadRequestException("worksiteId nevalid pentru acest tenant.");
    }

    const data: {
      code?: string;
      name?: string;
      worksiteId?: string | null;
      active?: boolean;
    } = {};
    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.worksiteId !== undefined) {
      data.worksiteId = dto.worksiteId.trim() ? dto.worksiteId.trim() : null;
    }
    if (dto.active !== undefined) data.active = dto.active;

    if (Object.keys(data).length === 0) return existing;

    try {
      return await this.prisma.department.update({ where: { id }, data });
    } catch {
      throw new ConflictException("Codul departamentului există deja pentru acest tenant.");
    }
  }

  // --- Posturi (funcții) ---
  listJobPositions(tenantId: string) {
    return this.prisma.jobPosition.findMany({
      where: { tenantId },
      orderBy: { code: "asc" }
    });
  }

  async createJobPosition(tenantId: string, dto: CreateJobPositionDto) {
    if (dto.departmentId) {
      const dep = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, tenantId }
      });
      if (!dep) throw new BadRequestException("departmentId nevalid pentru acest tenant.");
    }
    try {
      return await this.prisma.jobPosition.create({
        data: {
          tenantId,
          code: dto.code.trim(),
          name: dto.name.trim(),
          departmentId: dto.departmentId,
          corCode: dto.corCode?.trim(),
          description: dto.description?.trim(),
          active: dto.active ?? true
        }
      });
    } catch {
      throw new ConflictException("Codul postului există deja pentru acest tenant.");
    }
  }

  async updateJobPosition(tenantId: string, id: string, dto: UpdateJobPositionDto) {
    const existing = await this.prisma.jobPosition.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Post negăsit.");

    if (dto.departmentId !== undefined && dto.departmentId.trim()) {
      const dep = await this.prisma.department.findFirst({
        where: { id: dto.departmentId.trim(), tenantId }
      });
      if (!dep) throw new BadRequestException("departmentId nevalid pentru acest tenant.");
    }

    const data: {
      code?: string;
      name?: string;
      departmentId?: string | null;
      corCode?: string | null;
      description?: string | null;
      active?: boolean;
    } = {};
    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.departmentId !== undefined) {
      data.departmentId = dto.departmentId.trim() ? dto.departmentId.trim() : null;
    }
    if (dto.corCode !== undefined) data.corCode = dto.corCode.trim() ? dto.corCode.trim() : null;
    if (dto.description !== undefined) {
      data.description = dto.description.trim() ? dto.description.trim() : null;
    }
    if (dto.active !== undefined) data.active = dto.active;

    if (Object.keys(data).length === 0) return existing;

    try {
      return await this.prisma.jobPosition.update({ where: { id }, data });
    } catch {
      throw new ConflictException("Codul postului există deja pentru acest tenant.");
    }
  }

  // --- Angajați ---
  async listEmployees(tenantId: string, revealCnp: boolean) {
    const rows = await this.prisma.employee.findMany({
      where: { tenantId },
      orderBy: { fullName: "asc" },
      include: {
        worksite: true,
        department: true,
        jobPosition: true
      }
    });
    return rows.map((e) => ({
      ...e,
      cnp: this.maskCnp(e.cnp, revealCnp)
    }));
  }

  async getEmployee(tenantId: string, id: string, revealCnp: boolean) {
    const e = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: {
        worksite: true,
        department: true,
        jobPosition: true,
        placementHistory: { orderBy: { effectiveFrom: "desc" }, take: 50 }
      }
    });
    if (!e) throw new NotFoundException("Angajat negăsit.");
    return { ...e, cnp: this.maskCnp(e.cnp, revealCnp) };
  }

  async createEmployee(tenantId: string, dto: CreateEmployeeDto, actorUserId: string) {
    const cnpStored = this.encryptCnpIfPlain(dto.cnp);
    const hireDate = parseOptionalDate(dto.hireDate);
    const leaveDate = parseOptionalDate(dto.leaveDate);
    await this.assertOrgRefs(tenantId, dto.worksiteId, dto.departmentId, dto.jobPositionId);

    try {
      const created = await this.prisma.employee.create({
        data: {
          tenantId,
          email: dto.email.toLowerCase(),
          fullName: dto.fullName.trim(),
          cnp: cnpStored,
          worksiteId: dto.worksiteId,
          departmentId: dto.departmentId,
          jobPositionId: dto.jobPositionId,
          hireDate,
          leaveDate,
          active: dto.active ?? true
        }
      });
      await this.prisma.employeePlacementHistory.create({
        data: {
          tenantId,
          employeeId: created.id,
          worksiteId: dto.worksiteId,
          departmentId: dto.departmentId,
          jobPositionId: dto.jobPositionId,
          changeReason: "Creare inițială",
          createdByUserId: actorUserId
        }
      });
      await this.autoAssignTrainingPlan(
        tenantId,
        actorUserId,
        created.id,
        "INTRODUCTORY_GENERAL",
        "Flux automat la angajare nouă"
      );
      await this.autoAssignTrainingPlan(
        tenantId,
        actorUserId,
        created.id,
        "WORKPLACE",
        "Flux automat admitere la locul de muncă"
      );
      return created;
    } catch {
      throw new ConflictException("Adresa de e-mail a angajatului există deja pentru acest tenant.");
    }
  }

  async updateEmployee(tenantId: string, id: string, dto: UpdateEmployeeDto, actorUserId: string) {
    const existing = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Angajat negăsit.");

    await this.assertOrgRefs(tenantId, dto.worksiteId, dto.departmentId, dto.jobPositionId);

    const data: {
      email?: string;
      fullName?: string;
      cnp?: string | null;
      hireDate?: Date | null;
      leaveDate?: Date | null;
      active?: boolean;
      worksiteId?: string | null;
      departmentId?: string | null;
      jobPositionId?: string | null;
    } = {};
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.cnp !== undefined) data.cnp = dto.cnp ? this.encryptCnpIfPlain(dto.cnp) : null;
    if (dto.hireDate !== undefined) data.hireDate = dto.hireDate ? parseOptionalDate(dto.hireDate) : null;
    if (dto.leaveDate !== undefined) data.leaveDate = dto.leaveDate ? parseOptionalDate(dto.leaveDate) : null;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.worksiteId !== undefined) data.worksiteId = dto.worksiteId;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.jobPositionId !== undefined) data.jobPositionId = dto.jobPositionId;

    const placementChanged =
      dto.worksiteId !== undefined ||
      dto.departmentId !== undefined ||
      dto.jobPositionId !== undefined;

    const updated = await this.prisma.employee.update({
      where: { id },
      data: { ...data }
    });

    if (placementChanged) {
      await this.prisma.employeePlacementHistory.create({
        data: {
          tenantId,
          employeeId: id,
          worksiteId: updated.worksiteId,
          departmentId: updated.departmentId,
          jobPositionId: updated.jobPositionId,
          changeReason: "Actualizare profil",
          createdByUserId: actorUserId
        }
      });
      await this.autoAssignTrainingPlan(
        tenantId,
        actorUserId,
        updated.id,
        "SUPPLEMENTARY",
        "Flux automat la schimbare loc de muncă/funcție"
      );
    }

    return updated;
  }

  async updatePlacement(
    tenantId: string,
    employeeId: string,
    dto: UpdatePlacementDto,
    actorUserId: string
  ) {
    const existing = await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
    if (!existing) throw new NotFoundException("Angajat negăsit.");

    const worksiteId =
      dto.worksiteId === null ? null : dto.worksiteId ?? existing.worksiteId ?? undefined;
    const departmentId =
      dto.departmentId === null ? null : dto.departmentId ?? existing.departmentId ?? undefined;
    const jobPositionId =
      dto.jobPositionId === null ? null : dto.jobPositionId ?? existing.jobPositionId ?? undefined;

    await this.assertOrgRefs(
      tenantId,
      worksiteId ?? undefined,
      departmentId ?? undefined,
      jobPositionId ?? undefined
    );

    const updated = await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        worksiteId: worksiteId === undefined ? existing.worksiteId : worksiteId,
        departmentId: departmentId === undefined ? existing.departmentId : departmentId,
        jobPositionId: jobPositionId === undefined ? existing.jobPositionId : jobPositionId
      }
    });

    await this.prisma.employeePlacementHistory.create({
      data: {
        tenantId,
        employeeId,
        worksiteId: updated.worksiteId,
        departmentId: updated.departmentId,
        jobPositionId: updated.jobPositionId,
        changeReason: dto.changeReason,
        createdByUserId: actorUserId
      }
    });
    await this.autoAssignTrainingPlan(
      tenantId,
      actorUserId,
      employeeId,
      "SUPPLEMENTARY",
      "Flux automat la schimbare loc de muncă/funcție"
    );

    return updated;
  }

  private async assertOrgRefs(
    tenantId: string,
    worksiteId?: string,
    departmentId?: string,
    jobPositionId?: string
  ) {
    if (worksiteId) {
      const w = await this.prisma.worksite.findFirst({ where: { id: worksiteId, tenantId } });
      if (!w) throw new BadRequestException("worksiteId nevalid.");
    }
    if (departmentId) {
      const d = await this.prisma.department.findFirst({ where: { id: departmentId, tenantId } });
      if (!d) throw new BadRequestException("departmentId nevalid.");
    }
    if (jobPositionId) {
      const j = await this.prisma.jobPosition.findFirst({ where: { id: jobPositionId, tenantId } });
      if (!j) throw new BadRequestException("jobPositionId nevalid.");
    }
  }

  // --- Grupuri angajați ---
  listGroups(tenantId: string) {
    return this.prisma.employeeGroup.findMany({
      where: { tenantId },
      include: { _count: { select: { members: true } } },
      orderBy: { name: "asc" }
    });
  }

  async createGroup(tenantId: string, dto: CreateEmployeeGroupDto) {
    try {
      return await this.prisma.employeeGroup.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          active: dto.active ?? true
        }
      });
    } catch {
      throw new ConflictException("Numele grupului există deja pentru acest tenant.");
    }
  }

  async addGroupMember(tenantId: string, groupId: string, employeeId: string) {
    const g = await this.prisma.employeeGroup.findFirst({ where: { id: groupId, tenantId } });
    if (!g) throw new NotFoundException("Grup negăsit.");
    const e = await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
    if (!e) throw new NotFoundException("Angajat negăsit.");
    await this.prisma.employeeGroupMember.upsert({
      where: { groupId_employeeId: { groupId, employeeId } },
      create: { groupId, employeeId },
      update: {}
    });
    return { groupId, employeeId };
  }

  async removeGroupMember(tenantId: string, groupId: string, employeeId: string) {
    const g = await this.prisma.employeeGroup.findFirst({ where: { id: groupId, tenantId } });
    if (!g) throw new NotFoundException("Grup negăsit.");
    await this.prisma.employeeGroupMember.deleteMany({ where: { groupId, employeeId } });
    return { removed: true };
  }

  // --- Responsabili SSM ---
  listSsmResponsibles(tenantId: string) {
    return this.prisma.ssmResponsible.findMany({
      where: { tenantId },
      orderBy: { personName: "asc" }
    });
  }

  async createSsmResponsible(tenantId: string, dto: CreateSsmResponsibleDto) {
    if (dto.worksiteId) {
      const w = await this.prisma.worksite.findFirst({ where: { id: dto.worksiteId, tenantId } });
      if (!w) throw new BadRequestException("worksiteId nevalid.");
    }
    return this.prisma.ssmResponsible.create({
      data: {
        tenantId,
        type: dto.type,
        personName: dto.personName.trim(),
        worksiteId: dto.worksiteId,
        email: dto.email?.toLowerCase(),
        phone: dto.phone?.trim(),
        notes: dto.notes?.trim(),
        active: dto.active ?? true
      }
    });
  }

  // --- Import CSV angajați ---
  async importEmployeesFromCsv(
    tenantId: string,
    csvText: string,
    actorUserId: string
  ): Promise<{ created: number; updated: number; errors: { row: number; message: string }[] }> {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new BadRequestException("Fișierul CSV trebuie să conțină linia de antet și cel puțin o linie de date.");
    }
    const header = parseCsvRow(lines[0]).map((h) => h.toLowerCase());
    const idx = (name: string) => header.indexOf(name);

    const colEmail = idx("email");
    const colName = idx("fullname");
    if (colEmail < 0 || colName < 0) {
      throw new BadRequestException("Antetul CSV trebuie să includă coloanele email și fullName.");
    }

    const colCnp = idx("cnp");
    const colWs = idx("worksitecode");
    const colDep = idx("departmentcode");
    const colJob = idx("jobcode");
    const colHire = idx("hiredate");
    const colLeave = idx("leavedate");
    const colActive = idx("active");

    let created = 0;
    let updated = 0;
    const errors: { row: number; message: string }[] = [];

    const worksites = await this.prisma.worksite.findMany({ where: { tenantId } });
    const deps = await this.prisma.department.findMany({ where: { tenantId } });
    const jobs = await this.prisma.jobPosition.findMany({ where: { tenantId } });
    const wsByCode = new Map(worksites.map((w) => [w.code.toLowerCase(), w.id]));
    const depByCode = new Map(deps.map((d) => [d.code.toLowerCase(), d.id]));
    const jobByCode = new Map(jobs.map((j) => [j.code.toLowerCase(), j.id]));

    for (let r = 1; r < lines.length; r += 1) {
      const rowNum = r + 1;
      try {
        const cells = parseCsvRow(lines[r]);
        const email = cells[colEmail]?.toLowerCase();
        const fullName = cells[colName];
        if (!email || !fullName) {
          errors.push({ row: rowNum, message: "Lipsește adresa de e-mail sau numele complet." });
          continue;
        }

        const cnpRaw = colCnp >= 0 ? cells[colCnp] : undefined;
        const cnpStored = cnpRaw ? this.encryptCnpIfPlain(cnpRaw) : undefined;

        let worksiteId: string | undefined;
        if (colWs >= 0 && cells[colWs]) {
          const id = wsByCode.get(cells[colWs].toLowerCase());
          if (!id) {
            errors.push({ row: rowNum, message: `Cod punct de lucru necunoscut: ${cells[colWs]}` });
            continue;
          }
          worksiteId = id;
        }

        let departmentId: string | undefined;
        if (colDep >= 0 && cells[colDep]) {
          const id = depByCode.get(cells[colDep].toLowerCase());
          if (!id) {
            errors.push({ row: rowNum, message: `Cod departament necunoscut: ${cells[colDep]}` });
            continue;
          }
          departmentId = id;
        }

        let jobPositionId: string | undefined;
        if (colJob >= 0 && cells[colJob]) {
          const id = jobByCode.get(cells[colJob].toLowerCase());
          if (!id) {
            errors.push({ row: rowNum, message: `Cod post necunoscut: ${cells[colJob]}` });
            continue;
          }
          jobPositionId = id;
        }

        const hireDate =
          colHire >= 0 && cells[colHire] ? parseOptionalDate(cells[colHire]) : undefined;
        const leaveDate =
          colLeave >= 0 && cells[colLeave] ? parseOptionalDate(cells[colLeave]) : undefined;
        const active = colActive >= 0 ? parseBool(cells[colActive], true) : true;

        const existing = await this.prisma.employee.findUnique({
          where: { tenantId_email: { tenantId, email } }
        });

        if (existing) {
          await this.prisma.employee.update({
            where: { id: existing.id },
            data: {
              fullName: fullName.trim(),
              cnp: cnpStored ?? existing.cnp,
              worksiteId: worksiteId ?? existing.worksiteId,
              departmentId: departmentId ?? existing.departmentId,
              jobPositionId: jobPositionId ?? existing.jobPositionId,
              hireDate: hireDate ?? existing.hireDate,
              leaveDate: leaveDate ?? existing.leaveDate,
              active
            }
          });
          updated += 1;
        } else {
          const emp = await this.prisma.employee.create({
            data: {
              tenantId,
              email,
              fullName: fullName.trim(),
              cnp: cnpStored,
              worksiteId,
              departmentId,
              jobPositionId,
              hireDate,
              leaveDate,
              active
            }
          });
          await this.prisma.employeePlacementHistory.create({
            data: {
              tenantId,
              employeeId: emp.id,
              worksiteId,
              departmentId,
              jobPositionId,
              changeReason: "Import CSV",
              createdByUserId: actorUserId
            }
          });
          created += 1;
        }
      } catch (e) {
        errors.push({
          row: rowNum,
          message: e instanceof Error ? e.message : "Eroare necunoscută"
        });
      }
    }

    await this.auditLog.write({
      tenantId,
      actorId: actorUserId,
      module: "MASTER_DATA",
      action: "EMPLOYEE_CSV_IMPORT",
      entityType: "ImportBatch",
      entityId: "-",
      payload: { created, updated, errorCount: errors.length }
    });

    return { created, updated, errors };
  }
}
