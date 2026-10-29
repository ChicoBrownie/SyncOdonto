import { describe, expect, it } from "vitest"
import { calculateSupplyRisks, type SupplyAppointment, type SupplyItem, type SupplyOrder, type SupplyUsageRule } from "./planning"

const item: SupplyItem = {
  id: "item-1", name: "Anestésico", unit: "tubete", is_critical: true,
  usable_quantity: 2, minimum_quantity: 1,
  primary_supplier: "Dental A", primary_lead_days: 2,
  backup_supplier: null, backup_lead_days: null,
  last_counted_at: null, is_active: true,
}
const rule: SupplyUsageRule = { id: "rule-1", item_id: item.id, procedure_type: "Cirurgia", quantity_per_appointment: 1 }
const visits: SupplyAppointment[] = [
  { id: "1", date: "2026-10-21", procedure_type: "Cirurgia", status: "Confirmada" },
  { id: "2", date: "2026-10-22", procedure_type: "Cirurgia", status: "Pendente" },
  { id: "3", date: "2026-10-23", procedure_type: "Cirurgia", status: "Confirmada" },
  { id: "4", date: "2026-10-21", procedure_type: "Cirurgia", status: "Cancelada" },
]

describe("calculateSupplyRisks", () => {
  it("identifica a primeira consulta descoberta e a data limite de compra", () => {
    const [risk] = calculateSupplyRisks([item], [rule], [], visits, "2026-10-20")
    expect(risk).toMatchObject({ status: "shortage", scheduled_demand: 3, matching_appointments: 3, first_shortage_date: "2026-10-23", last_safe_order_date: "2026-10-20", suggested_replenishment_quantity: 1 })
  })

  it("não considera uma entrega prometida no próprio dia da consulta", () => {
    const order: SupplyOrder = { id: "order-1", item_id: item.id, supplier_name: "Dental A", quantity: 2, ordered_on: "2026-10-20", promised_on: "2026-10-23", received_on: null, status: "ordered" }
    expect(calculateSupplyRisks([item], [rule], [order], visits, "2026-10-20")[0].status).toBe("shortage")
    expect(calculateSupplyRisks([item], [rule], [{ ...order, promised_on: "2026-10-22" }], visits, "2026-10-20")[0].status).toBe("covered")
  })

  it("não apresenta ausência de risco quando falta regra de consumo", () => {
    expect(calculateSupplyRisks([item], [], [], visits, "2026-10-20")[0].status).toBe("unconfigured")
  })

  it("não usa uma entrega já atrasada para encobrir a falta", () => {
    const overdue: SupplyOrder = { id: "late", item_id: item.id, supplier_name: "Dental A", quantity: 10, ordered_on: "2026-10-15", promised_on: "2026-10-19", received_on: null, status: "ordered" }
    expect(calculateSupplyRisks([item], [rule], [overdue], visits, "2026-10-20")[0].first_shortage_date).toBe("2026-10-23")
  })

  it("não desconta de uma cotação a entrega prometida após a primeira falta", () => {
    const laterOrder: SupplyOrder = { id: "later", item_id: item.id, supplier_name: "Dental A", quantity: 10, ordered_on: "2026-10-20", promised_on: "2026-10-23", received_on: null, status: "ordered" }
    expect(calculateSupplyRisks([item], [rule], [laterOrder], visits, "2026-10-20")[0].suggested_replenishment_quantity).toBe(1)
  })
})
