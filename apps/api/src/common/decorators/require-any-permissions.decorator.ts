import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_ANY_KEY = "permissions_any";

export const RequireAnyPermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_ANY_KEY, permissions);
