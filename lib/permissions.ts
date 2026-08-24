// Tipos e lógica de permissões da equipe.
// Este arquivo é seguro para importar tanto no client (componentes "use client")
// quanto no server (rotas de API, middleware) — não importa nada de "next/server".
// Para o helper que retorna NextResponse, veja lib/permissions-server.ts.

export type StaffAccessRole = "gestor" | "dentista" | "recepcionista"

export type StaffPermissions = {
  financeiro: boolean
  relatorios: boolean
  configuracoes: boolean
}

// Padrão restritivo: só o gestor enxerga financeiro/relatórios/configurações
// por padrão. Dentista e recepcionista começam sem nenhum desses acessos —
// o gestor precisa liberar explicitamente pra cada membro, um por um.
export const DEFAULT_PERMISSIONS: Record<StaffAccessRole, StaffPermissions> = {
  gestor: { financeiro: true, relatorios: true, configuracoes: true },
  dentista: { financeiro: false, relatorios: false, configuracoes: false },
  recepcionista: { financeiro: false, relatorios: false, configuracoes: false },
}

/**
 * Calcula as permissões efetivas de um membro.
 * - Gestor sempre tem acesso total, mesmo que exista algo salvo em `overrides`
 *   (evita que um gestor se autolimite por engano e fique trancado pra fora).
 * - Para os demais cargos, começa do padrão restritivo e aplica os overrides
 *   individuais salvos em `clinic_staff.permissions`.
 */
export function getEffectivePermissions(
  accessRole: string | null | undefined,
  overrides?: Partial<StaffPermissions> | null
): StaffPermissions {
  const role: StaffAccessRole =
    accessRole === "gestor" || accessRole === "dentista" || accessRole === "recepcionista"
      ? accessRole
      : "recepcionista"

  if (role === "gestor") return { ...DEFAULT_PERMISSIONS.gestor }

  return { ...DEFAULT_PERMISSIONS[role], ...(overrides || {}) }
}

