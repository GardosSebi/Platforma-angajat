import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PaginationParams } from "@repo/shared-types/pagination";
import {
  platformAdminApi,
  type CreateScopedRolePayload,
  type CreateStaticPagePayload,
  type CreateTenantUserPayload,
  type PatchUserPayload,
  type UpdateStaticPagePayload
} from "../api/platform-admin.api";

export function useAdminUsers(params?: PaginationParams) {
  return useQuery({
    queryKey: ["platform-admin", "users", params?.page ?? 1, params?.pageSize ?? 50],
    queryFn: () => platformAdminApi.listUsers(params)
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTenantUserPayload) => platformAdminApi.createUser(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["platform-admin", "users"] }),
        queryClient.invalidateQueries({ queryKey: ["master-data", "employees"] })
      ]);
    }
  });
}

export function usePatchUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: PatchUserPayload }) =>
      platformAdminApi.patchUser(userId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["platform-admin", "users"] }),
        queryClient.invalidateQueries({ queryKey: ["master-data", "employees"] })
      ]);
    }
  });
}

export function useScopedRoles(userId?: string) {
  return useQuery({
    queryKey: ["platform-admin", "scoped-roles", userId],
    queryFn: () => platformAdminApi.listScopedRoles(userId!),
    enabled: Boolean(userId)
  });
}

export function useCreateScopedRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateScopedRolePayload) => platformAdminApi.createScopedRole(payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["platform-admin", "scoped-roles", variables.userId] });
    }
  });
}

export function useDeleteScopedRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => platformAdminApi.deleteScopedRole(id),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["platform-admin", "scoped-roles", variables.userId] });
    }
  });
}

export function useStaticPages(params?: PaginationParams) {
  return useQuery({
    queryKey: ["platform-admin", "static-pages", params?.page ?? 1, params?.pageSize ?? 25],
    queryFn: () => platformAdminApi.listStaticPages(params)
  });
}

export function useCreateStaticPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStaticPagePayload) => platformAdminApi.createStaticPage(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["platform-admin", "static-pages"] });
    }
  });
}

export function useUpdateStaticPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStaticPagePayload }) =>
      platformAdminApi.updateStaticPage(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["platform-admin", "static-pages"] });
    }
  });
}

export function useDeleteStaticPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => platformAdminApi.deleteStaticPage(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["platform-admin", "static-pages"] });
    }
  });
}

export function useItmAccessLogs() {
  return useQuery({
    queryKey: ["platform-admin", "itm-access-logs"],
    queryFn: () => platformAdminApi.listItmAccessLogs()
  });
}

export function useGrantItmAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, expiresAt }: { userId: string; expiresAt: string }) =>
      platformAdminApi.grantItmAccess(userId, expiresAt),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["platform-admin", "users"] }),
        queryClient.invalidateQueries({ queryKey: ["platform-admin", "itm-access-logs"] })
      ]);
    }
  });
}
