const STARTABLE_STATUSES = new Set(["Pendente", "Confirmada", "Aguardando"])

export function validateAppointmentTransition(previousStatus: string, nextStatus?: string) {
  if (!nextStatus || nextStatus === previousStatus) return null
  if (nextStatus === "Em Andamento" && !STARTABLE_STATUSES.has(previousStatus)) {
    return "Esta consulta não está disponível para início."
  }
  if (nextStatus === "Concluída" && previousStatus !== "Em Andamento") {
    return "Somente uma consulta em andamento pode ser encerrada."
  }
  return null
}

export function shouldCreateFinancialPending(previousStatus: string, nextStatus?: string) {
  return nextStatus === "Concluída" && previousStatus !== "Concluída"
}
