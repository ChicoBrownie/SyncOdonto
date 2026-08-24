import useSWR from "swr"
import type {
  Patient,
  Appointment,
  DentalChartEntry,
  ClinicalRecord,
  Treatment,
  Document,
  AIAnalysis,
  ClinicSettings,
  FinancialTransaction,
  DashboardStats,
} from "@/lib/types/database"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "An error occurred")
  }
  const data = await res.json()
  return data
}

// Dashboard
export function useDashboard() {
  const { data, error, isLoading, mutate } = useSWR("/api/dashboard", fetcher, {
    refreshInterval: 15_000,
    revalidateOnFocus: true,
  })
  return {
    stats: data?.stats as DashboardStats | undefined,
    upcomingAppointments: data?.upcomingAppointments as Appointment[] | undefined,
    recentPatients: data?.recentPatients as Patient[] | undefined,
    isLoading,
    error,
    mutate,
  }
}

// Patients
export function usePatients(search?: string, status?: string) {
  const params = new URLSearchParams()
  if (search) params.set("search", search)
  if (status) params.set("status", status)
  
  const { data, error, isLoading, mutate } = useSWR(
    `/api/patients?${params.toString()}`,
    fetcher
  )
  return {
    patients: data?.data as Patient[] | undefined,
    count: data?.count as number | undefined,
    isLoading,
    error,
    mutate,
  }
}

export function usePatient(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/patients/${id}` : null,
    fetcher
  )
  return {
    patient: data?.data as Patient | undefined,
    isLoading,
    error,
    mutate,
  }
}

// Appointments
export function useAppointments(options?: {
  date?: string
  startDate?: string
  endDate?: string
  status?: string
  patientId?: string
}) {
  const params = new URLSearchParams()
  if (options?.date) params.set("date", options.date)
  if (options?.startDate) params.set("startDate", options.startDate)
  if (options?.endDate) params.set("endDate", options.endDate)
  if (options?.status) params.set("status", options.status)
  if (options?.patientId) params.set("patientId", options.patientId)
  
  const { data, error, isLoading, mutate } = useSWR(
    `/api/appointments?${params.toString()}`,
    fetcher
  )
  return {
    appointments: data?.data as Appointment[] | undefined,
    isLoading,
    error,
    mutate,
  }
}

// Dental Charts
export function useDentalChart(patientId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    patientId ? `/api/dental-charts?patientId=${patientId}` : null,
    fetcher
  )
  return {
    dentalChart: data?.data as DentalChartEntry[] | undefined,
    isLoading,
    error,
    mutate,
  }
}

// Medical Records
export function useMedicalRecords(patientId?: string, recordType?: string) {
  const params = new URLSearchParams()
  if (patientId) params.set("patientId", patientId)
  if (recordType) params.set("recordType", recordType)
  
  const { data, error, isLoading, mutate } = useSWR(
    `/api/medical-records?${params.toString()}`,
    fetcher
  )
  return {
    records: data?.data as ClinicalRecord[] | undefined,
    isLoading,
    error,
    mutate,
  }
}

// Treatments
export function useTreatments(patientId?: string, status?: string) {
  const params = new URLSearchParams()
  if (patientId) params.set("patientId", patientId)
  if (status) params.set("status", status)
  
  const { data, error, isLoading, mutate } = useSWR(
    `/api/treatments?${params.toString()}`,
    fetcher
  )
  return {
    treatments: data?.data as Treatment[] | undefined,
    isLoading,
    error,
    mutate,
  }
}

// Documents
export function useDocuments(patientId?: string, documentType?: string) {
  const params = new URLSearchParams()
  if (patientId) params.set("patientId", patientId)
  if (documentType) params.set("documentType", documentType)
  
  const { data, error, isLoading, mutate } = useSWR(
    `/api/documents?${params.toString()}`,
    fetcher
  )
  return {
    documents: data?.data as Document[] | undefined,
    isLoading,
    error,
    mutate,
  }
}

// AI Analyses
export function useAIAnalyses(options?: {
  patientId?: string
  status?: string
  analysisType?: string
  limit?: number
}) {
  const params = new URLSearchParams()
  if (options?.patientId) params.set("patientId", options.patientId)
  if (options?.status) params.set("status", options.status)
  if (options?.analysisType) params.set("analysisType", options.analysisType)
  if (options?.limit) params.set("limit", options.limit.toString())
  
  const { data, error, isLoading, mutate } = useSWR(
    `/api/ai-analyses?${params.toString()}`,
    fetcher
  )
  return {
    analyses: data?.data as AIAnalysis[] | undefined,
    isLoading,
    error,
    mutate,
  }
}

// Clinic Settings
export function useClinicSettings() {
  const { data, error, isLoading, mutate } = useSWR(
    "/api/clinic-settings",
    fetcher
  )
  return {
    settings: data?.data as ClinicSettings | undefined,
    isLoading,
    error,
    mutate,
  }
}

// Financial Transactions
export function useFinancialTransactions(options?: {
  type?: string
  status?: string
  startDate?: string
  endDate?: string
  patientId?: string
}) {
  const params = new URLSearchParams()
  if (options?.type) params.set("type", options.type)
  if (options?.status) params.set("status", options.status)
  if (options?.startDate) params.set("startDate", options.startDate)
  if (options?.endDate) params.set("endDate", options.endDate)
  if (options?.patientId) params.set("patientId", options.patientId)
  
  const { data, error, isLoading, mutate } = useSWR(
    `/api/financial?${params.toString()}`,
    fetcher
  )
  return {
    transactions: data?.data as FinancialTransaction[] | undefined,
    isLoading,
    error,
    mutate,
  }
}

// API mutation helpers
export async function createPatient(data: Partial<Patient>) {
  const res = await fetch("/api/patients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to create patient")
  }
  return res.json()
}

export async function updatePatient(id: string, data: Partial<Patient>) {
  const res = await fetch(`/api/patients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to update patient")
  }
  return res.json()
}

export async function deletePatient(id: string) {
  const res = await fetch(`/api/patients/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to delete patient")
  }
  return res.json()
}

export async function createAppointment(data: Partial<Appointment>) {
  const res = await fetch("/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to create appointment")
  }
  return res.json()
}

export async function updateAppointment(id: string, data: Partial<Appointment>) {
  const res = await fetch(`/api/appointments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to update appointment")
  }
  return res.json()
}

export async function deleteAppointment(id: string) {
  const res = await fetch(`/api/appointments/${id}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to delete appointment")
  }
  return res.json()
}

export async function saveDentalChart(data: Partial<DentalChartEntry>) {
  const res = await fetch("/api/dental-charts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to save dental chart")
  }
  return res.json()
}

export async function createMedicalRecord(data: Partial<ClinicalRecord>) {
  const res = await fetch("/api/medical-records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to create medical record")
  }
  return res.json()
}

export async function createTreatment(data: Partial<Treatment>) {
  const res = await fetch("/api/treatments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to create treatment")
  }
  return res.json()
}

export async function updateTreatment(id: string, data: Partial<Treatment>) {
  const res = await fetch(`/api/treatments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to update treatment")
  }
  return res.json()
}

export async function createDocument(data: Partial<Document>) {
  const res = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to create document")
  }
  return res.json()
}

export async function createAIAnalysis(data: Partial<AIAnalysis>) {
  const res = await fetch("/api/ai-analyses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to create AI analysis")
  }
  return res.json()
}

export async function updateAIAnalysis(id: string, data: Partial<AIAnalysis>) {
  const res = await fetch(`/api/ai-analyses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to update AI analysis")
  }
  return res.json()
}

export async function saveClinicSettings(data: Partial<ClinicSettings>) {
  const res = await fetch("/api/clinic-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to save clinic settings")
  }
  return res.json()
}

export async function createFinancialTransaction(data: Partial<FinancialTransaction>) {
  const res = await fetch("/api/financial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "Failed to create transaction")
  }
  return res.json()
}
