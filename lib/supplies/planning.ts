export type SupplyItem = {
  id: string
  name: string
  unit: string
  is_critical: boolean
  usable_quantity: number
  minimum_quantity: number
  primary_supplier: string | null
  primary_lead_days: number | null
  backup_supplier: string | null
  backup_lead_days: number | null
  last_counted_at: string | null
  is_active: boolean
}

export type SupplyUsageRule = {
  id: string
  item_id: string
  procedure_type: string
  quantity_per_appointment: number
}

export type SupplyOrder = {
  id: string
  item_id: string
  supplier_name: string
  quantity: number
  ordered_on: string
  promised_on: string
  received_on: string | null
  status: "ordered" | "received" | "cancelled"
}

export type SupplyAppointment = {
  id: string
  date: string
  procedure_type: string
  status: string
}

export type SupplyRisk = {
  item_id: string
  status: "unconfigured" | "shortage" | "low_stock" | "covered"
  scheduled_demand: number
  matching_appointments: number
  first_shortage_date: string | null
  last_safe_order_date: string | null
  pending_quantity: number
  suggested_replenishment_quantity: number
}

const ACTIVE_STATUSES = new Set(["Pendente", "Confirmada", "Aguardando", "Atrasado", "Em Andamento", "scheduled", "confirmed", "in_progress"])

export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function normalizedProcedure(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR")
}

/**
 * Estimates future material needs. A promised order is counted only for appointments
 * after its promised date: delivery at an unknown hour cannot protect a same-day visit.
 * This is a planning aid, not an automatic clinical or purchasing decision.
 */
export function calculateSupplyRisks(
  items: SupplyItem[],
  rules: SupplyUsageRule[],
  orders: SupplyOrder[],
  appointments: SupplyAppointment[],
  today: string,
  horizonDays = 14,
): SupplyRisk[] {
  const endDate = addCalendarDays(today, horizonDays)
  const activeAppointments = appointments
    .filter((appointment) => ACTIVE_STATUSES.has(appointment.status) && appointment.date >= today && appointment.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date))

  return items.filter((item) => item.is_active).map((item) => {
    const itemRules = rules.filter((rule) => rule.item_id === item.id)
    const quantityByProcedure = new Map(itemRules.map((rule) => [normalizedProcedure(rule.procedure_type), Number(rule.quantity_per_appointment)]))
    const matching = activeAppointments
      .map((appointment) => ({ date: appointment.date, quantity: quantityByProcedure.get(normalizedProcedure(appointment.procedure_type)) || 0 }))
      .filter((entry) => entry.quantity > 0)
    // An overdue promise is not reliable stock. Keep it visible in the order list,
    // but do not let it hide a shortage in the appointment forecast.
    const pending = orders.filter((order) => order.item_id === item.id && order.status === "ordered" && order.promised_on >= today)
    let scheduledDemand = 0
    let firstShortageDate: string | null = null
    let suggestedReplenishmentQuantity = 0
    for (const entry of matching) {
      scheduledDemand += entry.quantity
      const availableByDate = Number(item.usable_quantity) + pending
        .filter((order) => order.promised_on < entry.date)
        .reduce((sum, order) => sum + Number(order.quantity), 0)
      const deficit = Math.max(0, scheduledDemand - availableByDate)
      suggestedReplenishmentQuantity = Math.max(suggestedReplenishmentQuantity, deficit)
      if (firstShortageDate === null && deficit > 0) firstShortageDate = entry.date
    }
    const status: SupplyRisk["status"] = itemRules.length === 0
      ? "unconfigured"
      : firstShortageDate
        ? "shortage"
        : Number(item.usable_quantity) <= Number(item.minimum_quantity)
          ? "low_stock"
          : "covered"
    return {
      item_id: item.id,
      status,
      scheduled_demand: scheduledDemand,
      matching_appointments: matching.length,
      first_shortage_date: firstShortageDate,
      last_safe_order_date: firstShortageDate !== null && item.primary_lead_days !== null
        ? addCalendarDays(firstShortageDate, -item.primary_lead_days - 1)
        : null,
      pending_quantity: pending.reduce((sum, order) => sum + Number(order.quantity), 0),
      suggested_replenishment_quantity: suggestedReplenishmentQuantity,
    }
  })
}
