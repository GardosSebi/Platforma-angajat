import { Body, Controller, Get, Header, Param, Patch, Post, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { TenantGuard } from "../../../auth/tenant.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../../common/decorators/require-permissions.decorator";
import { TenantId } from "../../../common/decorators/tenant-id.decorator";
import { Permission } from "../../../common/constants/permissions";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { SsmEipService } from "../application/services/ssm-eip.service";
import {
  CreateEipMovementDto,
  CreateEipNormDto,
  CreateEipOrderDto,
  CreateEipTypeDto,
  SignEipRegisterDto,
  UpdateEipOrderDto
} from "./dto/ssm-eip.dto";

@Controller("ssm/eip")
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SsmEipController {
  constructor(private readonly eipService: SsmEipService) {}

  @Get("types")
  @RequirePermissions(Permission.SSM_EIP_VIEW)
  listTypes(@TenantId() tenantId: string) {
    return this.eipService.listTypes(tenantId);
  }

  @Post("types")
  @RequirePermissions(Permission.SSM_EIP_EDIT)
  createType(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateEipTypeDto) {
    return this.eipService.createType(tenantId, user.sub, dto);
  }

  @Get("norms")
  @RequirePermissions(Permission.SSM_EIP_VIEW)
  listNorms(@TenantId() tenantId: string) {
    return this.eipService.listNorms(tenantId);
  }

  @Post("norms")
  @RequirePermissions(Permission.SSM_EIP_EDIT)
  upsertNorm(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateEipNormDto) {
    return this.eipService.upsertNorm(tenantId, user.sub, dto);
  }

  @Post("movements")
  @RequirePermissions(Permission.SSM_EIP_EDIT)
  movement(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateEipMovementDto) {
    return this.eipService.registerMovement(tenantId, user.sub, dto);
  }

  @Get("register")
  @RequirePermissions(Permission.SSM_EIP_VIEW)
  register(@TenantId() tenantId: string) {
    return this.eipService.movementRegister(tenantId);
  }

  @Get("register.pdf")
  @RequirePermissions(Permission.SSM_EIP_VIEW)
  @Header("Content-Type", "application/pdf")
  async registerPdf(@TenantId() tenantId: string) {
    const buffer = await this.eipService.registerPdf(tenantId);
    return new StreamableFile(buffer, {
      disposition: 'attachment; filename="registru-eip.pdf"'
    });
  }

  @Get("notifications")
  @RequirePermissions(Permission.SSM_EIP_VIEW)
  notifications(@TenantId() tenantId: string) {
    return this.eipService.dueNotifications(tenantId);
  }

  @Post("notifications/dispatch")
  @RequirePermissions(Permission.SSM_EIP_EDIT)
  dispatchNotifications(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }) {
    return this.eipService.dispatchReminders(tenantId, user.sub);
  }

  @Get("reports/stock-gap")
  @RequirePermissions(Permission.SSM_EIP_VIEW)
  stockGap(@TenantId() tenantId: string) {
    return this.eipService.stockGapReport(tenantId);
  }

  @Get("orders")
  @RequirePermissions(Permission.SSM_EIP_VIEW)
  listOrders(@TenantId() tenantId: string) {
    return this.eipService.listOrders(tenantId);
  }

  @Post("orders")
  @RequirePermissions(Permission.SSM_EIP_EDIT)
  createOrder(@TenantId() tenantId: string, @CurrentUser() user: { sub: string }, @Body() dto: CreateEipOrderDto) {
    return this.eipService.createOrder(tenantId, user.sub, dto);
  }

  @Patch("orders/:orderId")
  @RequirePermissions(Permission.SSM_EIP_EDIT)
  updateOrder(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string },
    @Param("orderId") orderId: string,
    @Body() dto: UpdateEipOrderDto
  ) {
    return this.eipService.updateOrder(tenantId, user.sub, orderId, dto);
  }

  @Post("movements/:movementId/photo")
  @UseInterceptors(FileInterceptor("photo", { storage: memoryStorage() }))
  @RequirePermissions(Permission.SSM_EIP_EDIT, Permission.FILES_UPLOAD)
  attachPhoto(
    @TenantId() tenantId: string,
    @Param("movementId") movementId: string,
    @UploadedFile() photo?: Express.Multer.File
  ) {
    return this.eipService.attachMovementPhoto(tenantId, movementId, photo);
  }

  @Get("movements/:movementId/photo")
  @RequirePermissions(Permission.SSM_EIP_VIEW)
  downloadPhoto(@TenantId() tenantId: string, @Param("movementId") movementId: string) {
    return this.eipService.downloadMovementPhoto(tenantId, movementId);
  }

  @Get("register/signoff")
  @RequirePermissions(Permission.SSM_EIP_VIEW)
  latestSignoff(@TenantId() tenantId: string) {
    return this.eipService.latestRegisterSignoff(tenantId);
  }

  @Post("register/sign")
  @RequirePermissions(Permission.SSM_EIP_APPROVE)
  signRegister(
    @TenantId() tenantId: string,
    @CurrentUser() user: { sub: string; email?: string },
    @Body() dto: SignEipRegisterDto
  ) {
    return this.eipService.signRegister(tenantId, user.sub, user.email, dto);
  }
}
