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
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { UpdatePlacementDto } from "./dto/update-placement.dto";
import { CreateEmployeeGroupDto } from "./dto/create-group.dto";
import { CreateSsmResponsibleDto } from "./dto/create-ssm-responsible.dto";

function parseOptionalDate(value?: string): Date | undefined {
  if (!value || !value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
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

  // --- Worksites ---
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
      throw new ConflictException("Worksite code already exists for this tenant");
    }
  }

  // --- Departments ---
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
      if (!ws) throw new BadRequestException("Invalid worksiteId for tenant");
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
      throw new ConflictException("Department code already exists for this tenant");
    }
  }

  // --- Job positions ---
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
      if (!dep) throw new BadRequestException("Invalid departmentId for tenant");
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
      throw new ConflictException("Job code already exists for this tenant");
    }
  }

  // --- Employees ---
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
    if (!e) throw new NotFoundException("Employee not found");
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
          changeReason: "Initial create",
          createdByUserId: actorUserId
        }
      });
      return created;
    } catch {
      throw new ConflictException("Employee email already exists for this tenant");
    }
  }

  async updateEmployee(tenantId: string, id: string, dto: UpdateEmployeeDto, actorUserId: string) {
    const existing = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException("Employee not found");

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
          changeReason: "Profile update",
          createdByUserId: actorUserId
        }
      });
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
    if (!existing) throw new NotFoundException("Employee not found");

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
      if (!w) throw new BadRequestException("Invalid worksiteId");
    }
    if (departmentId) {
      const d = await this.prisma.department.findFirst({ where: { id: departmentId, tenantId } });
      if (!d) throw new BadRequestException("Invalid departmentId");
    }
    if (jobPositionId) {
      const j = await this.prisma.jobPosition.findFirst({ where: { id: jobPositionId, tenantId } });
      if (!j) throw new BadRequestException("Invalid jobPositionId");
    }
  }

  // --- Groups ---
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
      throw new ConflictException("Group name already exists for this tenant");
    }
  }

  async addGroupMember(tenantId: string, groupId: string, employeeId: string) {
    const g = await this.prisma.employeeGroup.findFirst({ where: { id: groupId, tenantId } });
    if (!g) throw new NotFoundException("Group not found");
    const e = await this.prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
    if (!e) throw new NotFoundException("Employee not found");
    await this.prisma.employeeGroupMember.upsert({
      where: { groupId_employeeId: { groupId, employeeId } },
      create: { groupId, employeeId },
      update: {}
    });
    return { groupId, employeeId };
  }

  async removeGroupMember(tenantId: string, groupId: string, employeeId: string) {
    const g = await this.prisma.employeeGroup.findFirst({ where: { id: groupId, tenantId } });
    if (!g) throw new NotFoundException("Group not found");
    await this.prisma.employeeGroupMember.deleteMany({ where: { groupId, employeeId } });
    return { removed: true };
  }

  // --- SSM responsibles ---
  listSsmResponsibles(tenantId: string) {
    return this.prisma.ssmResponsible.findMany({
      where: { tenantId },
      orderBy: { personName: "asc" }
    });
  }

  async createSsmResponsible(tenantId: string, dto: CreateSsmResponsibleDto) {
    if (dto.worksiteId) {
      const w = await this.prisma.worksite.findFirst({ where: { id: dto.worksiteId, tenantId } });
      if (!w) throw new BadRequestException("Invalid worksiteId");
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

  // --- CSV import ---
  async importEmployeesFromCsv(
    tenantId: string,
    csvText: string,
    actorUserId: string
  ): Promise<{ created: number; updated: number; errors: { row: number; message: string }[] }> {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new BadRequestException("CSV must include header and at least one data row");
    }
    const header = parseCsvRow(lines[0]).map((h) => h.toLowerCase());
    const idx = (name: string) => header.indexOf(name);

    const colEmail = idx("email");
    const colName = idx("fullname");
    if (colEmail < 0 || colName < 0) {
      throw new BadRequestException("CSV header must include email,fullName");
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
          errors.push({ row: rowNum, message: "Missing email or fullName" });
          continue;
        }

        const cnpRaw = colCnp >= 0 ? cells[colCnp] : undefined;
        const cnpStored = cnpRaw ? this.encryptCnpIfPlain(cnpRaw) : undefined;

        let worksiteId: string | undefined;
        if (colWs >= 0 && cells[colWs]) {
          const id = wsByCode.get(cells[colWs].toLowerCase());
          if (!id) {
            errors.push({ row: rowNum, message: `Unknown worksite code ${cells[colWs]}` });
            continue;
          }
          worksiteId = id;
        }

        let departmentId: string | undefined;
        if (colDep >= 0 && cells[colDep]) {
          const id = depByCode.get(cells[colDep].toLowerCase());
          if (!id) {
            errors.push({ row: rowNum, message: `Unknown department code ${cells[colDep]}` });
            continue;
          }
          departmentId = id;
        }

        let jobPositionId: string | undefined;
        if (colJob >= 0 && cells[colJob]) {
          const id = jobByCode.get(cells[colJob].toLowerCase());
          if (!id) {
            errors.push({ row: rowNum, message: `Unknown job code ${cells[colJob]}` });
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
              changeReason: "CSV import",
              createdByUserId: actorUserId
            }
          });
          created += 1;
        }
      } catch (e) {
        errors.push({
          row: rowNum,
          message: e instanceof Error ? e.message : "Unknown error"
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
