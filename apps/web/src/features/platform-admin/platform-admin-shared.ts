export type PlatformAdminTab = "scoped-roles" | "itm-access" | "static-pages";

export const PLATFORM_ADMIN_TABS: Array<{ id: PlatformAdminTab; label: string }> = [
  { id: "scoped-roles", label: "Roluri scoped" },
  { id: "itm-access", label: "Acces ITM" },
  { id: "static-pages", label: "Pagini statice" }
];

export const SCOPED_ROLE_OPTIONS = [
  "SSM_ENTITY_RESPONSIBLE",
  "DEPARTMENT_MANAGER",
  "ITM_INSPECTOR",
  "EMPLOYEE"
] as const;

export const STATIC_AUDIENCE_OPTIONS = [
  { value: "ALL", label: "Toți angajații" },
  { value: "WORKSITE", label: "Punct de lucru" },
  { value: "EMPLOYEE_GROUP", label: "Grup angajați" }
] as const;
