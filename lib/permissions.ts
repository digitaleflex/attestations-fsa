export type Permission =
  | "users:read"
  | "users:write"
  | "users:delete"
  | "formations:read"
  | "formations:write"
  | "formations:delete"
  | "exams:read"
  | "exams:write"
  | "exams:delete"
  | "attestations:read"
  | "attestations:write"
  | "settings:read"
  | "settings:write";

export const PERMISSIONS: Permission[] = [
  "users:read",
  "users:write",
  "users:delete",
  "formations:read",
  "formations:write",
  "formations:delete",
  "exams:read",
  "exams:write",
  "exams:delete",
  "attestations:read",
  "attestations:write",
  "settings:read",
  "settings:write",
];

export type Role = "admin" | "user" | string;

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [...PERMISSIONS],
  user: [],
};

export const rolePermissions = ROLE_PERMISSIONS;
export const permissionsByRole = ROLE_PERMISSIONS;
export const RolePermissions = ROLE_PERMISSIONS;

export function getPermissionsForRole(role: Role | null | undefined): Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[String(role).toLowerCase()] ?? [];
}

export function getPermissions(role: Role | null | undefined): Permission[] {
  return getPermissionsForRole(role);
}

type RoleLike = Role | { role?: Role | null } | null | undefined;

function toRole(input: RoleLike): Role | null | undefined {
  if (input && typeof input === "object") {
    return (input as { role?: Role | null }).role;
  }
  return input as Role | null | undefined;
}

export function hasPermission(
  roleOrUser: RoleLike,
  permission: Permission,
): boolean {
  const role = toRole(roleOrUser);
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}

export function can(roleOrUser: RoleLike, permission: Permission): boolean {
  return hasPermission(roleOrUser, permission);
}

export const isAdminRole = (role: Role | null | undefined): boolean =>
  String(role ?? "").toLowerCase() === "admin";
