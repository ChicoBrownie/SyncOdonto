import type { SupabaseClient } from "@supabase/supabase-js"

const SHEETS_PER_DOCUMENT = 3
const SHEETS_PER_TREE = 10_000
const CO2_KG_PER_SHEET = 0.0045
const WATER_LITERS_PER_SHEET = 10

// Tipos que representam documentos clínicos emitidos pelo produto. Anexos e
// exames enviados pelo usuário não entram na estimativa de papel substituído.
const PAPERLESS_DOCUMENT_TYPES = [
  "consent",
  "consent_form",
  "tcle",
  "termo",
  "budget",
  "orcamento",
  "quote",
  "medical_record",
  "prontuario",
  "anamnesis",
  "anamnese",
  "certificate",
  "atestado",
  "attestation",
]

export type SustainabilityPeriodMetrics = {
  documents: number
  sheets: number
  trees: number
  co2Kg: number
  waterLiters: number
}

export type SustainabilityMetrics = {
  month: SustainabilityPeriodMetrics
  allTime: SustainabilityPeriodMetrics
  calculatedAt: string
}

function convertDocumentsToImpact(documents: number): SustainabilityPeriodMetrics {
  const sheets = documents * SHEETS_PER_DOCUMENT

  return {
    documents,
    sheets,
    trees: sheets / SHEETS_PER_TREE,
    co2Kg: sheets * CO2_KG_PER_SHEET,
    waterLiters: sheets * WATER_LITERS_PER_SHEET,
  }
}

/**
 * Conta os documentos digitais da clínica e converte a economia de papel em
 * estimativas ambientais. A data inicial usa UTC para coincidir com o formato
 * timestamptz gravado pelo Supabase.
 */
export async function calculateSustainabilityMetrics(
  supabase: SupabaseClient,
  clinicOwnerId: string,
  now = new Date(),
): Promise<SustainabilityMetrics> {
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  const baseCount = () =>
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", clinicOwnerId)
      .in("document_type", PAPERLESS_DOCUMENT_TYPES)

  const [monthResult, allTimeResult] = await Promise.all([
    baseCount().gte("created_at", startOfMonth),
    baseCount(),
  ])

  if (monthResult.error) throw new Error(`Falha ao contar documentos do mês: ${monthResult.error.message}`)
  if (allTimeResult.error) throw new Error(`Falha ao contar documentos acumulados: ${allTimeResult.error.message}`)

  return {
    month: convertDocumentsToImpact(monthResult.count ?? 0),
    allTime: convertDocumentsToImpact(allTimeResult.count ?? 0),
    calculatedAt: now.toISOString(),
  }
}
