"use client";

import { useSession } from "@/lib/auth-client";
import {
  hasPermission as hasPermissionForRole,
  type Permission,
  type Role,
  getPermissionsForRole,
} from "@/lib/permissions";

export interface UsePermissionsResult {
  role: Role;
  permissions: Permission[];
  hasPermission: (permission: Permission) => boolean;
  can: (permission: Permission) => boolean;
}

export function usePermissions(): UsePermissionsResult {
  const { data: session } = useSession();
  const role = (session?.user?.role as Role | undefined) ?? "user";

  const permissions = getPermissionsForRole(role);

  const hasPermission = (permission: Permission) =>
    hasPermissionForRole(role, permission);

  return {
    role,
    permissions,
    hasPermission,
    can: hasPermission,
  };
}

export function useHasPermission(permission: Permission): boolean {
  const { hasPermission } = usePermissions();
  return hasPermission(permission);
}

export default usePermissions;
