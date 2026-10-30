import type { ImportKind } from "./spreadsheet"

export const importFieldLabels: Record<ImportKind, Record<string, string>> = {
  patients: {
    source_id: "ID no sistema anterior", full_name: "Nome", email: "Email", phone: "Telefone", insurance: "Convênio",
    date_of_birth: "Data de nascimento", gender: "Gênero", cpf: "CPF", address: "Endereço",
    allergies: "Alergias", pre_existing_conditions: "Condições pré-existentes", medications: "Medicamentos",
    notes: "Observações", clinical_notes: "Histórico clínico", inline_record_id: "ID do prontuário", inline_record_date: "Data do atendimento",
    inline_record_doctor: "Profissional do atendimento", inline_record_procedure: "Procedimento realizado",
    inline_exam_id: "ID do exame", inline_exam_date: "Data do exame", inline_exam_type: "Tipo do exame",
    inline_exam_description: "Descrição do exame", inline_exam_result: "Resultado do exame", exam_title: "Nome do exame", exam_file: "Arquivo do exame",
  },
  records: {
    source_id: "ID do prontuário", patient_ref: "ID, CPF ou nome do paciente", title: "Título", content: "Conteúdo",
    record_type: "Tipo", record_date: "Data", doctor_name: "Profissional",
  },
  exams: {
    source_id: "ID do exame", patient_ref: "ID, CPF ou nome do paciente", title: "Nome do exame", exam_date: "Data do exame",
    exam_type: "Tipo", description: "Descrição ou laudo", file_name: "Nome do arquivo PDF ou imagem",
  },
}
