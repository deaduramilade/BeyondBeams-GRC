import type { Role } from "@prisma/client";
import { hasPermission, type Permission } from "@/lib/security";

export type UiCapabilities = Record<Permission, boolean>;

export function uiCapabilities(role: Role | string): UiCapabilities {
  const permissions: Permission[] = [
    "risk:create", "risk:update", "risk:delete", "risk:read",
    "framework:manage", "mapping:manage", "member:manage", "audit:read",
    "report:export", "settings:manage", "assessment:approve", "treatment:manage",
    "treatment:approve", "control:manage", "evidence:manage", "appetite:manage", "taxonomy:manage",
  ];
  return Object.fromEntries(permissions.map((permission) => [permission, hasPermission(role, permission)])) as UiCapabilities;
}

export function disabledReason(allowed: boolean, reason = "Your role does not have permission to use this control.") {
  return allowed ? undefined : reason;
}