import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { EmployeeStaticAudienceType, Prisma, RoleAssignmentScope } from "@prisma/client";
import { SystemRole } from "../../common/prisma-enums";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { MasterDataService } from "../master-data/master-data.service";
import { CreateScopedRoleDto } from "./api/dto/create-scoped-role.dto";
import { CreateStaticPageDto, UpdateStaticPageDto } from "./api/dto/create-static-page.dto";
import { CreateTenantUserDto } from "./api/dto/create-tenant-user.dto";
import { PatchTenantUserDto } from "./api/dto/patch-tenant-user.dto";
import { PaginationQueryDto, resolvePagination } from "../../common/dto/pagination-query.dto";
import { paginatedResult } from "../../common/pagination";
import { JwtPayload } from "../../auth/jwt.strategy";
import {
  applyWorksiteToEmployeeWhere,
  resolveWorksiteViewerScope,
  worksiteIdsFromScope
} from "../../common/worksite-viewer-scope";

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masterData: MasterDataService
  ) {}

  async listTenantUsers(tenantId: string, query?: PaginationQueryDto) {
    const p = resolvePagination(query);
    const where = { tenantId };
    const select = {
      id: true,
      email: true,
      fullName: true,
      active: true,
      roles: true,
      createdAt: true,
      updatedAt: true
    } as const;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select,
        orderBy: { email: "asc" },
        skip: p.skip,
        take: p.take
      }),
      this.prisma.user.count({ where })
    ]);
    return paginatedResult(items, total, p.page, p.pageSize);
  }

  async createTenantUser(
    tenantId: string,
    actorUserId: string,
    actorRoles: string[],
    dto: CreateTenantUserDto
  ) {
    const email = dto.email.toLowerCase().trim();
    const roles: SystemRole[] =
      dto.roles && dto.roles.length > 0 ? dto.roles : [SystemRole.EMPLOYEE];

    if (roles.includes(SystemRole.SSM_ADMIN) && !actorRoles.includes(SystemRole.SSM_ADMIN as string)) {
      throw new ForbiddenException("Doar un administrator SSM poate atribui rolul SSM_ADMIN.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    let userId: string | undefined;
    try {
      const user = await this.prisma.user.create({
        data: {
          tenantId,
          email,
          passwordHash,
          fullName: dto.fullName.trim(),
          roles,
          active: true
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          active: true,
          roles: true,
          createdAt: true,
          updatedAt: true
        }
      });
      userId = user.id;

      await this.masterData.createEmployee(
        tenantId,
        {
          email,
          fullName: dto.fullName.trim(),
          cnp: dto.cnp,
          worksiteId: dto.worksiteId,
          departmentId: dto.departmentId,
          jobPositionId: dto.jobPositionId,
          hireDate: dto.hireDate,
          active: true
        },
        actorUserId
      );

      return user;
    } catch (e) {
      if (userId) {
        await this.prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : "";
        if (target.includes("Employee")) {
          throw new ConflictException("Există deja un angajat cu acest e-mail în tenant.");
        }
        throw new ConflictException("Există deja un utilizator cu acest e-mail în tenant.");
      }
      throw e;
    }
  }

  async patchTenantUser(tenantId: string, actorRoles: string[], userId: string, dto: PatchTenantUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId }
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (dto.roles?.includes(SystemRole.SSM_ADMIN) && !actorRoles.includes(SystemRole.SSM_ADMIN as string)) {
      throw new ForbiddenException("Doar un administrator SSM poate atribui rolul SSM_ADMIN.");
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.roles !== undefined ? { roles: dto.roles } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {})
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        active: true,
        roles: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async listScopedRoles(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.prisma.userScopedRole.findMany({
      where: { tenantId, userId },
      include: {
        worksite: { select: { id: true, code: true, name: true } },
        employeeGroup: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async createScopedRole(tenantId: string, actorUserId: string, dto: CreateScopedRoleDto) {
    const userId = dto.userId;
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (dto.scope === RoleAssignmentScope.WORKSITE) {
      if (!dto.worksiteId) {
        throw new BadRequestException("worksiteId is required for WORKSITE scope");
      }
      const ws = await this.prisma.worksite.findFirst({
        where: { id: dto.worksiteId, tenantId },
        select: { id: true }
      });
      if (!ws) {
        throw new BadRequestException("Worksite not found in tenant");
      }
      return this.prisma.userScopedRole.create({
        data: {
          tenantId,
          userId,
          role: dto.role,
          scope: RoleAssignmentScope.WORKSITE,
          worksiteId: dto.worksiteId,
          employeeGroupId: null,
          createdByUserId: actorUserId
        },
        include: {
          worksite: { select: { id: true, code: true, name: true } },
          employeeGroup: { select: { id: true, name: true } }
        }
      });
    }
    if (!dto.employeeGroupId) {
      throw new BadRequestException("employeeGroupId is required for EMPLOYEE_GROUP scope");
    }
    const group = await this.prisma.employeeGroup.findFirst({
      where: { id: dto.employeeGroupId, tenantId },
      select: { id: true }
    });
    if (!group) {
      throw new BadRequestException("Employee group not found in tenant");
    }
    return this.prisma.userScopedRole.create({
      data: {
        tenantId,
        userId,
        role: dto.role,
        scope: RoleAssignmentScope.EMPLOYEE_GROUP,
        worksiteId: null,
        employeeGroupId: dto.employeeGroupId,
        createdByUserId: actorUserId
      },
      include: {
        worksite: { select: { id: true, code: true, name: true } },
        employeeGroup: { select: { id: true, name: true } }
      }
    });
  }

  async deleteScopedRole(tenantId: string, assignmentId: string) {
    const row = await this.prisma.userScopedRole.findFirst({
      where: { id: assignmentId, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Assignment not found");
    }
    await this.prisma.userScopedRole.delete({ where: { id: assignmentId } });
    return { ok: true };
  }

  private async assertAudience(
    tenantId: string,
    audienceType: EmployeeStaticAudienceType,
    audienceRefId: string | null | undefined
  ) {
    if (audienceType === EmployeeStaticAudienceType.ALL) {
      if (audienceRefId) {
        throw new BadRequestException("audienceRefId must be empty for ALL audience");
      }
      return;
    }
    if (!audienceRefId) {
      throw new BadRequestException("audienceRefId is required for targeted audience");
    }
    if (audienceType === EmployeeStaticAudienceType.WORKSITE) {
      const ws = await this.prisma.worksite.findFirst({
        where: { id: audienceRefId, tenantId },
        select: { id: true }
      });
      if (!ws) {
        throw new BadRequestException("audienceRefId worksite not found");
      }
    } else {
      const g = await this.prisma.employeeGroup.findFirst({
        where: { id: audienceRefId, tenantId },
        select: { id: true }
      });
      if (!g) {
        throw new BadRequestException("audienceRefId group not found");
      }
    }
  }

  async createStaticPage(tenantId: string, actorUserId: string, dto: CreateStaticPageDto) {
    const audienceType = dto.audienceType ?? EmployeeStaticAudienceType.ALL;
    const audienceRefId = dto.audienceRefId ?? null;
    await this.assertAudience(tenantId, audienceType, audienceRefId);
    try {
      return await this.prisma.employeeStaticPage.create({
        data: {
          tenantId,
          slug: dto.slug,
          title: dto.title,
          bodyMarkdown: dto.bodyMarkdown,
          audienceType,
          audienceRefId,
          sortOrder: dto.sortOrder ?? 0,
          published: dto.published ?? false,
          attachmentName: dto.attachmentName ?? null,
          attachmentPath: dto.attachmentPath ?? null,
          attachmentMime: dto.attachmentMime ?? null,
          attachmentSize: dto.attachmentSize ?? null,
          createdBy: actorUserId
        }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Slug already exists for this tenant");
      }
      throw e;
    }
  }

  async listStaticPagesAdmin(tenantId: string, query?: PaginationQueryDto) {
    const p = resolvePagination(query);
    const where = { tenantId };
    const [items, total] = await Promise.all([
      this.prisma.employeeStaticPage.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        skip: p.skip,
        take: p.take
      }),
      this.prisma.employeeStaticPage.count({ where })
    ]);
    return paginatedResult(items, total, p.page, p.pageSize);
  }

  async updateStaticPage(tenantId: string, pageId: string, dto: UpdateStaticPageDto) {
    const existing = await this.prisma.employeeStaticPage.findFirst({
      where: { id: pageId, tenantId }
    });
    if (!existing) {
      throw new NotFoundException("Page not found");
    }
    const audienceType = dto.audienceType ?? existing.audienceType;
    const audienceRefId =
      dto.audienceRefId !== undefined ? dto.audienceRefId : existing.audienceRefId;
    if (dto.audienceType !== undefined || dto.audienceRefId !== undefined) {
      await this.assertAudience(tenantId, audienceType, audienceRefId);
    }
    try {
      return await this.prisma.employeeStaticPage.update({
        where: { id: pageId },
        data: {
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.bodyMarkdown !== undefined ? { bodyMarkdown: dto.bodyMarkdown } : {}),
          ...(dto.audienceType !== undefined ? { audienceType: dto.audienceType } : {}),
          ...(dto.audienceRefId !== undefined ? { audienceRefId: dto.audienceRefId } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
          ...(dto.published !== undefined ? { published: dto.published } : {}),
          ...(dto.attachmentName !== undefined ? { attachmentName: dto.attachmentName } : {}),
          ...(dto.attachmentPath !== undefined ? { attachmentPath: dto.attachmentPath } : {}),
          ...(dto.attachmentMime !== undefined ? { attachmentMime: dto.attachmentMime } : {}),
          ...(dto.attachmentSize !== undefined ? { attachmentSize: dto.attachmentSize } : {})
        }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException("Slug already exists for this tenant");
      }
      throw e;
    }
  }

  async deleteStaticPage(tenantId: string, pageId: string) {
    const existing = await this.prisma.employeeStaticPage.findFirst({
      where: { id: pageId, tenantId }
    });
    if (!existing) {
      throw new NotFoundException("Page not found");
    }
    await this.prisma.employeeStaticPage.delete({ where: { id: pageId } });
    return { ok: true };
  }

  async listPublishedStaticPagesForEmployee(
    tenantId: string,
    worksiteId?: string,
    groupIds: string[] = []
  ) {
    const or: Prisma.EmployeeStaticPageWhereInput[] = [{ audienceType: EmployeeStaticAudienceType.ALL }];
    if (worksiteId) {
      or.push({
        audienceType: EmployeeStaticAudienceType.WORKSITE,
        audienceRefId: worksiteId
      });
    }
    if (groupIds.length > 0) {
      or.push({
        audienceType: EmployeeStaticAudienceType.EMPLOYEE_GROUP,
        audienceRefId: { in: groupIds }
      });
    }
    return this.prisma.employeeStaticPage.findMany({
      where: {
        tenantId,
        published: true,
        OR: or
      },
      select: {
        id: true,
        slug: true,
        title: true,
        sortOrder: true,
        audienceType: true,
        attachmentName: true,
        attachmentMime: true,
        attachmentSize: true,
        updatedAt: true
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }]
    });
  }

  async getPublishedStaticPageBySlug(
    tenantId: string,
    slug: string,
    worksiteId?: string,
    groupIds: string[] = []
  ) {
    const page = await this.prisma.employeeStaticPage.findFirst({
      where: { tenantId, slug, published: true }
    });
    if (!page) {
      throw new NotFoundException("Page not found");
    }
    const visible =
      page.audienceType === EmployeeStaticAudienceType.ALL ||
      (page.audienceType === EmployeeStaticAudienceType.WORKSITE &&
        !!worksiteId &&
        page.audienceRefId === worksiteId) ||
      (page.audienceType === EmployeeStaticAudienceType.EMPLOYEE_GROUP &&
        !!page.audienceRefId &&
        groupIds.includes(page.audienceRefId));
    if (!visible) {
      throw new NotFoundException("Page not found");
    }
    return page;
  }

  async getEmployeeDirectory(tenantId: string, viewer: JwtPayload) {
    const roles = viewer.roles ?? [];
    if (!roles.includes(SystemRole.SSM_ADMIN)) {
      throw new ForbiddenException("Doar administratorii SSM pot vizualiza directorul complet al organizației.");
    }

    const viewerEmail = viewer.email.trim().toLowerCase();

    const [worksites, employees, users] = await Promise.all([
      this.prisma.worksite.findMany({
        where: { tenantId, active: true },
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true }
      }),
      this.prisma.employee.findMany({
        where: { tenantId, active: true },
        include: {
          worksite: { select: { id: true, code: true, name: true } },
          department: { select: { name: true } },
          jobPosition: { select: { name: true } }
        },
        orderBy: { fullName: "asc" }
      }),
      this.prisma.user.findMany({
        where: { tenantId, active: true },
        select: {
          id: true,
          email: true,
          fullName: true,
          roles: true
        },
        orderBy: { email: "asc" }
      })
    ]);

    const userByEmail = new Map(users.map((u) => [u.email.trim().toLowerCase(), u]));

    const mapMember = (e: (typeof employees)[number]) => {
      const linked = userByEmail.get(e.email.trim().toLowerCase());
      return {
        employeeId: e.id,
        fullName: e.fullName,
        email: e.email,
        jobPositionName: e.jobPosition?.name ?? null,
        departmentName: e.department?.name ?? null,
        platformRoles: linked ? [...linked.roles] : [],
        isSelf: e.email.trim().toLowerCase() === viewerEmail
      };
    };

    const worksiteGroups: Array<{
      worksite: { id: string; code: string; name: string } | null;
      members: ReturnType<typeof mapMember>[];
    }> = worksites.map((ws) => ({
      worksite: ws,
      members: employees.filter((e) => e.worksiteId === ws.id).map(mapMember)
    }));

    const withoutWorksite = employees.filter((e) => !e.worksiteId);
    if (withoutWorksite.length > 0) {
      worksiteGroups.push({
        worksite: null,
        members: withoutWorksite.map(mapMember)
      });
    }

    const employeeByEmail = new Map(employees.map((e) => [e.email.trim().toLowerCase(), e]));

    const administrators = users
      .filter((u) => u.roles.includes(SystemRole.SSM_ADMIN))
      .map((u) => {
        const emp = employeeByEmail.get(u.email.trim().toLowerCase());
        return {
          userId: u.id,
          email: u.email,
          fullName: u.fullName,
          roles: [...u.roles],
          employeeId: emp?.id ?? null,
          employeeFullName: emp?.fullName ?? null,
          worksiteName: emp?.worksite?.name ?? null,
          isSelf: u.email.trim().toLowerCase() === viewerEmail
        };
      });

    return {
      worksites: worksiteGroups,
      administrators,
      totals: {
        employees: employees.length,
        administrators: administrators.length,
        worksites: worksites.length
      }
    };
  }

  async getEmployeeMyContext(tenantId: string, viewer: JwtPayload) {
    const scope = await resolveWorksiteViewerScope(this.prisma, tenantId, viewer);
    const scopedWorksiteIds = worksiteIdsFromScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: {
        tenantId,
        active: true,
        email: { equals: viewer.email, mode: "insensitive" }
      },
      include: {
        worksite: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        jobPosition: { select: { id: true, code: true, name: true } },
        groupMembers: {
          where: { group: { active: true } },
          include: {
            group: {
              include: {
                members: {
                  include: {
                    employee: {
                      select: {
                        id: true,
                        fullName: true,
                        email: true,
                        active: true,
                        worksiteId: true,
                        jobPosition: { select: { name: true } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!employee) {
      return {
        worksiteRestricted: scopedWorksiteIds !== null,
        linked: false,
        employee: null,
        departmentTeam: null,
        groups: []
      };
    }

    const memberVisible = (worksiteId: string | null) => {
      if (scopedWorksiteIds === null) return true;
      return Boolean(worksiteId && scopedWorksiteIds.includes(worksiteId));
    };

    const mapMember = (e: {
      id: string;
      fullName: string;
      email: string;
      active: boolean;
      jobPosition: { name: string } | null;
    }) => ({
      id: e.id,
      fullName: e.fullName,
      email: e.email,
      jobPositionName: e.jobPosition?.name ?? null,
      isSelf: e.id === employee.id
    });

    const groups = employee.groupMembers.map((gm) => {
      const members = gm.group.members
        .map((m) => m.employee)
        .filter((e) => e.active && memberVisible(e.worksiteId))
        .map(mapMember)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "ro"));
      return {
        id: gm.group.id,
        name: gm.group.name,
        description: gm.group.description,
        members
      };
    });

    let departmentTeam: {
      department: { id: string; code: string; name: string };
      members: ReturnType<typeof mapMember>[];
    } | null = null;

    if (employee.department) {
      const colleagues = await this.prisma.employee.findMany({
        where: applyWorksiteToEmployeeWhere(
          { tenantId, departmentId: employee.department.id, active: true },
          scope
        ),
        select: {
          id: true,
          fullName: true,
          email: true,
          jobPosition: { select: { name: true } }
        },
        orderBy: { fullName: "asc" }
      });
      departmentTeam = {
        department: employee.department,
        members: colleagues.map((e) => mapMember({ ...e, active: true }))
      };
    }

    return {
      worksiteRestricted: scopedWorksiteIds !== null,
      linked: true,
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        email: employee.email,
        worksite: employee.worksite,
        department: employee.department,
        jobPosition: employee.jobPosition
      },
      departmentTeam,
      groups
    };
  }

  async getUsageSummary(tenantId: string, from: Date, to: Date) {
    const whereAudit: Prisma.AuditLogWhereInput = {
      tenantId,
      createdAt: { gte: from, lte: to }
    };
    const [
      auditByModule,
      distinctActors,
      userCount,
      employeeCount,
      ticketCount,
      surveyResponseCount
    ] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ["module"],
        where: whereAudit,
        _count: { _all: true }
      }),
      this.prisma.auditLog.findMany({
        where: whereAudit,
        distinct: ["actorId"],
        select: { actorId: true }
      }),
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.employee.count({ where: { tenantId } }),
      this.prisma.helpdeskTicket.count({
        where: { tenantId, createdAt: { gte: from, lte: to } }
      }),
      this.prisma.surveyResponse.count({
        where: { tenantId, submittedAt: { gte: from, lte: to } }
      })
    ]);

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      auditEventsByModule: auditByModule.map((r) => ({
        module: r.module,
        events: r._count._all
      })),
      distinctUsersWithAuditActions: distinctActors.length,
      totals: {
        users: userCount,
        employees: employeeCount,
        helpdeskTicketsCreatedInPeriod: ticketCount,
        surveyResponsesInPeriod: surveyResponseCount
      }
    };
  }
}
