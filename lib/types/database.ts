export type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string | null
  created_at: string
  updated_at: string
}

export type Patient = {
  id: string
  user_id: string
  full_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  gender: string | null
  cpf: string | null
  address: string | null
  medical_history: any | null
  allergies: string | null
  pre_existing_conditions: string | null
  medications: string | null
  notes: string | null
  status: 'Ativo' | 'Inativo' | 'Em Tratamento' | 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export type Appointment = {
  id: string
  user_id: string
  patient_id: string
  date: string
  time: string
  duration_minutes: number | null
  procedure_type: string
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  cost: number | null
  payment_method: string | null
  notes: string | null
  created_at: string
  updated_at: string
  patient?: Pick<Patient, 'id' | 'full_name' | 'phone' | 'email'>
}

export type ClinicalRecord = {
  id: string
  user_id: string
  patient_id: string
  title: string
  description: string | null
  diagnosis: string | null
  treatment: string | null
  notes: string | null
  created_at: string
  patient?: Pick<Patient, 'id' | 'full_name'>
}

export type DentalChartEntry = {
  id: string
  user_id: string
  patient_id: string
  tooth_number: number
  condition: string | null
  notes: string | null
  updated_at: string
}

export type Treatment = {
  id: string
  patient_id: string
  user_id: string
  tooth_number: number | null
  treatment_type: string
  description: string | null
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  cost: number
  notes: string | null
  scheduled_date: string | null
  completed_date: string | null
  created_at: string
  updated_at: string
}

export type Document = {
  id: string
  patient_id: string | null
  user_id: string
  title: string
  document_type: string
  status: 'draft' | 'signed' | 'archived'
  content: string | null
  file_url: string | null
  signed_at: string | null
  created_at: string
  updated_at: string
}

export type AIAnalysis = {
  id: string
  patient_id: string | null
  user_id: string
  analysis_type: string
  status: 'pending' | 'processing' | 'completed' | 'error' | 'failed'
  confidence: number | null
  confidence_score: number | null
  findings: AIFinding[] | null
  recommendations: any[] | null
  image_url: string | null
  created_at: string
  updated_at: string
  patient?: Pick<Patient, 'id' | 'full_name'>
}

export type AIFinding = {
  id: string
  description: string
  severity: 'low' | 'medium' | 'high'
  location?: string
  tooth_number?: number
  confidence: number
  recommendation?: string
}

export type ClinicSettings = {
  id: string
  user_id: string
  clinic_name: string
  address: string | null
  phone: string | null
  email: string | null
  working_hours: { start: string; end: string }
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

export type FinancialTransaction = {
  id: string
  patient_id: string | null
  treatment_id: string | null
  user_id: string
  type: 'income' | 'expense'
  amount: number
  description: string | null
  payment_method: string | null
  status: 'pending' | 'paid' | 'cancelled'
  due_date: string | null
  paid_date: string | null
  verification_status?: 'pending_verification' | 'confirmed' | 'incorrect' | null
  source_appointment_id?: string | null
  created_at: string
}

export type DashboardStats = {
  totalPatients: number
  appointmentsToday: number
  pendingTreatments: number
  monthlyRevenue: number
  aiAnalysesToday: number
  completedTreatments: number
}
