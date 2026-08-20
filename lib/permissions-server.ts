// Helper exclusivo de servidor (usa NextResponse) — NÃO importe este arquivo
// em componentes "use client". Para os tipos/lógica pura, use lib/permissions.ts.

import { NextResponse } from "next/server"
import type { StaffPermissions } from "@/lib/permissions"

/**
 * Verifica se `permissions[key]` é true. Se não for, devolve uma resposta 403
 * pronta pra ser retornada direto da rota. Se a permissão existir, devolve null
 * (segue o fluxo normal).
 *
 * Uso dentro de uma rota:
 *   const denied = requirePermission(permissions, "financeiro")
 *   if (denied) return denied
 */
export function requirePermission(
  permissions: StaffPermissions | null | undefined,
  key: keyof StaffPermissions
) {
  if (!permissions?.[key]) {
    return NextResponse.json(
      { error: "Você não tem permissão para acessar este recurso. Fale com o gestor da clínica." },
      { status: 403 }
    )
  }
  return null
}
