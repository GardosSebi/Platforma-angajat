import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { PlatformAdminService } from "../platform-admin.service";

@Controller("platform/employee-static")
@UseGuards(JwtAuthGuard, TenantGuard)
export class EmployeeStaticController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @Get("pages")
  list(
    @TenantId() tenantId: string,
    @Query("worksiteId") worksiteId?: string,
    @Query("groupIds") groupIds?: string
  ) {
    const groups = groupIds
      ? groupIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return this.platformAdmin.listPublishedStaticPagesForEmployee(tenantId, worksiteId, groups);
  }

  @Get("pages/:slug")
  getOne(
    @TenantId() tenantId: string,
    @Param("slug") slug: string,
    @Query("worksiteId") worksiteId?: string,
    @Query("groupIds") groupIds?: string
  ) {
    const groups = groupIds
      ? groupIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return this.platformAdmin.getPublishedStaticPageBySlug(tenantId, slug, worksiteId, groups);
  }
}
