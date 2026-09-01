import { z } from "zod"

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional()
const uuid = z.string().uuid()

export const patientInputSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254).nullable().optional(),
  phone: nullableText(20),
  date_of_birth: nullableText(10),
  gender: nullableText(30),
  cpf: nullableText(14),
  address: nullableText(500),
  medical_history: z.unknown().optional(),
  allergies: nullableText(2000),
  pre_existing_conditions: nullableText(2000),
  medications: nullableText(2000),
  notes: nullableText(5000),
  status: z.enum(["Ativo", "Inativo", "Em Tratamento", "active", "inactive"]).optional(),
})

export const appointmentInputSchema = z.object({
  patient_id: uuid,
  date: z.string().date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  duration_minutes: z.number().int().min(5).max(720).optional(),
  procedure_type: z.string().trim().min(1).max(200),
  doctor_name: z.string().trim().min(2).max(160),
  status: z.string().trim().max(40).optional(),
  cost: z.number().min(0).max(100_000_000).nullable().optional(),
  payment_method: nullableText(80),
  notes: nullableText(5000),
})

export const financialInputSchema = z.object({
  patient_id: uuid,
  treatment_id: uuid.nullable().optional(),
  type: z.enum(["income", "expense"]),
  amount: z.number().positive().max(100_000_000),
  description: z.string().trim().min(1).max(500),
  payment_method: nullableText(80),
  status: z.enum(["pending", "paid", "cancelled"]).optional(),
  due_date: nullableText(30),
  paid_date: nullableText(30),
  verification_status: z.enum(["pending_verification", "confirmed", "incorrect"]).nullable().optional(),
  source_appointment_id: uuid.nullable().optional(),
})

export const staffCreateSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  role: z.string().trim().max(100).optional(),
  specialty: nullableText(160),
  email: z.string().trim().email().max(254).nullable().optional(),
  phone: nullableText(20),
  access_role: z.enum(["dentista", "recepcionista"]),
  permissions: z.object({
    financeiro: z.boolean().optional(),
    relatorios: z.boolean().optional(),
    configuracoes: z.boolean().optional(),
  }).optional(),
  password: z.string().min(10).max(128).optional(),
})

export const documentInputSchema = z.object({
  patient_id: uuid.nullable().optional(),
  title: z.string().trim().min(1).max(200),
  document_type: z.string().trim().min(1).max(80),
  description: nullableText(20_000),
  procedure: nullableText(500),
  status: z.enum(["signed", "pending", "draft", "archived"]).optional(),
  signed: z.boolean().optional(),
  signature_data: nullableText(2_000_000),
  content: nullableText(100_000),
  storage_path: nullableText(1000),
  file_type: nullableText(100),
  file_size: z.number().int().nonnegative().max(15_728_640).nullable().optional(),
  lead_name: nullableText(160),
  lead_phone: nullableText(20),
  items: z.array(z.unknown()).max(100).nullable().optional(),
  total_amount: z.number().nonnegative().max(100_000_000).nullable().optional(),
  payment_method: nullableText(80),
  generate_pdf: z.boolean().optional(),
})

export const dataSubjectRequestSchema = z.object({
  request_type: z.enum(["export", "deletion"]),
  reason: nullableText(2000),
})

const dailyHoursSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closed: z.boolean(),
})

export const clinicSettingsSchema = z.object({
  clinic_name: nullableText(200),
  cnpj: nullableText(30),
  address: nullableText(500),
  city: nullableText(120),
  state: nullableText(50),
  zip_code: nullableText(20),
  phone: nullableText(30),
  email: z.string().email().max(254).nullable().optional().or(z.literal("")),
  website: nullableText(500),
  logo_url: nullableText(2000),
  working_hours: z.object({
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    days: z.record(z.string(), dailyHoursSchema).optional(),
  }).optional(),
  appointment_duration: z.number().int().min(5).max(480).optional(),
})

export const dentalChartInputSchema = z.object({
  patient_id: uuid,
  tooth_number: z.number().int().min(11).max(85),
  condition: z.enum(["healthy", "caries", "filled", "extracted", "crown", "implant", "bridge", "root_canal", "fracture", "absent"]).nullable(),
  surface_conditions: z.record(
    z.enum(["vestibular", "lingual", "mesial", "distal", "occlusal"]),
    z.enum(["healthy", "caries", "filled", "extracted", "crown", "implant", "bridge", "root_canal", "fracture", "absent"]),
  ).optional(),
  notes: nullableText(5000),
})

export const medicalRecordInputSchema = z.object({
  patient_id: uuid,
  appointment_id: uuid.nullable().optional(),
  record_type: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  content: nullableText(50_000),
  description: nullableText(50_000),
  doctor_name: nullableText(160),
  record_date: nullableText(30),
  attachments: z.array(z.string().max(2000)).max(20).optional(),
})

export const anamnesisInputSchema = z.object({
  patient_id: uuid,
  chief_complaint: nullableText(5000),
  dentist_name: nullableText(160),
  answers: z.array(z.object({
    question: z.string().trim().min(1).max(500),
    answer: z.enum(["sim", "nao"]),
    observation: z.string().trim().max(2000).optional(),
  })).max(100),
  additional_notes: nullableText(10_000),
  diagnosis: nullableText(10_000),
  treatment_plan: nullableText(20_000),
})

export function parseInput<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value)
  if (result.success) return { data: result.data, error: null }
  return {
    data: null,
    error: result.error.issues.map((issue) => `${issue.path.join(".") || "corpo"}: ${issue.message}`).join("; "),
  }
}
