import { Body, Controller, Get, Header, Param, Patch, Post, Put, StreamableFile, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmCssmService } from "../application/services/ssm-cssm.service";
import {
  CreateSsmCssmCommitteeDto,
  CreateSsmCssmMeetingDto,
  CreateSsmCssmMemberDto,
  UpdateSsmCssmAttendeeDto,
  UpdateSsmCssmCommitteeDto,
  UpdateSsmCssmMeetingDto,
  UpdateSsmCssmMemberDto,
  UpsertSsmCssmMinutesDto
} from "./dto/ssm-cssm.dto";

@Controller("ssm/cssm")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmCssmController {
  constructor(private readonly cssm: SsmCssmService) {}

  @Get("committees")
  @RequirePermissions(Permission.SSM_CSSM_VIEW)
  list(@TenantId() tenantId: string) {
    return this.cssm.listCommittees(tenantId);
  }

  @Post("committees")
  @RequirePermissions(Permission.SSM_CSSM_EDIT)
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: CreateSsmCssmCommitteeDto
  ) {
    return this.cssm.createCommittee(tenantId, user.sub, dto);
  }

  @Get("committees/:id")
  @RequirePermissions(Permission.SSM_CSSM_VIEW)
  get(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.cssm.getCommittee(tenantId, id);
  }

  @Patch("committees/:id")
  @RequirePermissions(Permission.SSM_CSSM_EDIT)
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string,
    @Body() dto: UpdateSsmCssmCommitteeDto
  ) {
    return this.cssm.updateCommittee(tenantId, user.sub, id, dto);
  }

  @Post("committees/:id/members")
  @RequirePermissions(Permission.SSM_CSSM_EDIT)
  addMember(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string,
    @Body() dto: CreateSsmCssmMemberDto
  ) {
    return this.cssm.addMember(tenantId, user.sub, id, dto);
  }

  @Patch("members/:memberId")
  @RequirePermissions(Permission.SSM_CSSM_EDIT)
  updateMember(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("memberId") memberId: string,
    @Body() dto: UpdateSsmCssmMemberDto
  ) {
    return this.cssm.updateMember(tenantId, user.sub, memberId, dto);
  }

  @Post("committees/:id/meetings")
  @RequirePermissions(Permission.SSM_CSSM_EDIT)
  createMeeting(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("id") id: string,
    @Body() dto: CreateSsmCssmMeetingDto
  ) {
    return this.cssm.createMeeting(tenantId, user.sub, id, dto);
  }

  @Patch("meetings/:meetingId")
  @RequirePermissions(Permission.SSM_CSSM_EDIT)
  updateMeeting(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("meetingId") meetingId: string,
    @Body() dto: UpdateSsmCssmMeetingDto
  ) {
    return this.cssm.updateMeeting(tenantId, user.sub, meetingId, dto);
  }

  @Post("meetings/:meetingId/convene")
  @RequirePermissions(Permission.SSM_CSSM_EDIT)
  convene(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("meetingId") meetingId: string
  ) {
    return this.cssm.conveneMeeting(tenantId, user.sub, meetingId);
  }

  @Post("meetings/:meetingId/hold")
  @RequirePermissions(Permission.SSM_CSSM_EDIT)
  hold(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("meetingId") meetingId: string
  ) {
    return this.cssm.holdMeeting(tenantId, user.sub, meetingId);
  }

  @Post("meetings/:meetingId/cancel")
  @RequirePermissions(Permission.SSM_CSSM_EDIT)
  cancel(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("meetingId") meetingId: string
  ) {
    return this.cssm.cancelMeeting(tenantId, user.sub, meetingId);
  }

  @Patch("attendees/:attendeeId")
  @RequirePermissions(Permission.SSM_CSSM_EDIT)
  updateAttendee(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("attendeeId") attendeeId: string,
    @Body() dto: UpdateSsmCssmAttendeeDto
  ) {
    return this.cssm.updateAttendee(tenantId, user.sub, attendeeId, dto);
  }

  @Put("meetings/:meetingId/minutes")
  @RequirePermissions(Permission.SSM_CSSM_EDIT)
  upsertMinutes(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("meetingId") meetingId: string,
    @Body() dto: UpsertSsmCssmMinutesDto
  ) {
    return this.cssm.upsertMinutes(tenantId, user.sub, meetingId, dto);
  }

  @Get("meetings/:meetingId/convocation.pdf")
  @RequirePermissions(Permission.SSM_CSSM_VIEW)
  @Header("Content-Type", "application/pdf")
  async convocationPdf(@TenantId() tenantId: string, @Param("meetingId") meetingId: string) {
    const buffer = await this.cssm.convocationPdf(tenantId, meetingId);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename="convocare-cssm-${meetingId}.pdf"`
    });
  }

  @Get("meetings/:meetingId/minutes.pdf")
  @RequirePermissions(Permission.SSM_CSSM_VIEW)
  @Header("Content-Type", "application/pdf")
  async minutesPdf(@TenantId() tenantId: string, @Param("meetingId") meetingId: string) {
    const buffer = await this.cssm.minutesPdf(tenantId, meetingId);
    return new StreamableFile(buffer, {
      disposition: `attachment; filename="proces-verbal-cssm-${meetingId}.pdf"`
    });
  }
}
