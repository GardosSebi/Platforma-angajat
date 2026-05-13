import { Body, Controller, Get, Header, Param, Patch, Post, Req, StreamableFile, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SurveysService } from "../application/services/surveys.service";
import { CreatePublicLinkDto, CreateSurveyDto, SubmitSurveyResponseDto, UpdateSurveyDto } from "./dto/surveys.dto";

@Controller("surveys")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SurveysController {
  constructor(private readonly surveys: SurveysService) {}

  @Get("health")
  health() {
    return { module: "surveys", status: "ok" };
  }

  @Get("overview")
  @RequirePermissions(Permission.SURVEYS_VIEW)
  overview(@TenantId() tenantId: string) {
    return this.surveys.overview(tenantId);
  }

  @Get()
  @RequirePermissions(Permission.SURVEYS_VIEW)
  list(@TenantId() tenantId: string) {
    return this.surveys.list(tenantId);
  }

  @Get(":id/for-respond")
  @RequirePermissions(Permission.SURVEYS_RESPOND)
  forRespond(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.surveys.getForRespond(tenantId, id);
  }

  @Post()
  @RequirePermissions(Permission.SURVEYS_EDIT)
  create(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateSurveyDto) {
    return this.surveys.create(tenantId, user.sub, dto);
  }

  @Patch(":id")
  @RequirePermissions(Permission.SURVEYS_EDIT)
  update(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Param("id") id: string, @Body() dto: UpdateSurveyDto) {
    return this.surveys.update(tenantId, user.sub, id, dto);
  }

  @Patch(":id/activate")
  @RequirePermissions(Permission.SURVEYS_EDIT)
  activate(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.surveys.activate(tenantId, user.sub, id);
  }

  @Patch(":id/close")
  @RequirePermissions(Permission.SURVEYS_EDIT)
  close(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.surveys.close(tenantId, user.sub, id);
  }

  @Post(":id/private-link")
  @RequirePermissions(Permission.SURVEYS_VIEW)
  privateLink(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.surveys.privateLink(tenantId, id);
  }

  @Post(":id/public-link")
  @RequirePermissions(Permission.SURVEYS_EDIT)
  publicLink(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Param("id") id: string, @Body() dto: CreatePublicLinkDto) {
    return this.surveys.createPublicLink(tenantId, user.sub, id, dto);
  }

  @Post(":id/responses")
  @RequirePermissions(Permission.SURVEYS_RESPOND)
  respond(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Param("id") id: string, @Body() dto: SubmitSurveyResponseDto) {
    return this.surveys.submitPrivateResponse(tenantId, user.sub, id, dto);
  }

  @Get(":id/stats")
  @RequirePermissions(Permission.SURVEYS_VIEW)
  stats(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.surveys.stats(tenantId, id);
  }

  @Get(":id/export.json")
  @RequirePermissions(Permission.SURVEYS_EXPORT)
  @Header("Content-Type", "application/json")
  async exportJson(@TenantId() tenantId: string, @Param("id") id: string) {
    return new StreamableFile(await this.surveys.exportJson(tenantId, id), {
      disposition: `attachment; filename=\"survey-${id}.json\"`
    });
  }

  @Get(":id/export.xlsx")
  @RequirePermissions(Permission.SURVEYS_EXPORT)
  @Header("Content-Type", "application/vnd.ms-excel")
  async exportExcel(@TenantId() tenantId: string, @Param("id") id: string) {
    return new StreamableFile(await this.surveys.exportExcel(tenantId, id), {
      disposition: `attachment; filename=\"survey-${id}.xls\"`
    });
  }

  @Get(":id/export.pdf")
  @RequirePermissions(Permission.SURVEYS_EXPORT)
  @Header("Content-Type", "application/pdf")
  async exportPdf(@TenantId() tenantId: string, @Param("id") id: string) {
    return new StreamableFile(await this.surveys.exportPdf(tenantId, id), {
      disposition: `attachment; filename=\"survey-${id}.pdf\"`
    });
  }
}

@Controller("surveys/public")
export class PublicSurveysController {
  constructor(private readonly surveys: SurveysService) {}

  @Get(":token")
  getPublicSurvey(@Param("token") token: string) {
    return this.surveys.publicSurvey(token);
  }

  @Post(":token/responses")
  submitPublicResponse(@Param("token") token: string, @Body() dto: SubmitSurveyResponseDto, @Req() req: Request) {
    const userAgent = req.headers["user-agent"];
    return this.surveys.submitPublicResponse(token, dto, {
      ip: req.ip,
      userAgent: Array.isArray(userAgent) ? userAgent.join(" ") : userAgent
    });
  }
}
