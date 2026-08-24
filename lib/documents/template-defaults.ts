export const TEMPLATE_TYPES = ["dental_certificate", "dental_prescription", "anamnesis"] as const
export type TemplateType = typeof TEMPLATE_TYPES[number]
export type AnamnesisQuestion = { id: string; text: string; answerType: "yes_no" | "text"; required: boolean }
export type PaperlessTemplate = { type: TemplateType; name: string; description: string; content: string; questions: AnamnesisQuestion[]; customized?: boolean }

export const AUTOMATIC_FIELDS = [
  { token: "{{paciente_nome}}", label: "Nome do paciente" },
  { token: "{{paciente_cpf}}", label: "CPF do paciente" },
  { token: "{{data_nascimento}}", label: "Data de nascimento" },
  { token: "{{data_atendimento}}", label: "Data do atendimento" },
  { token: "{{dentista_nome}}", label: "Nome do dentista" },
  { token: "{{dentista_cro}}", label: "CRO do dentista" },
  { token: "{{clinica_nome}}", label: "Nome da clínica" },
  { token: "{{clinica_endereco}}", label: "Endereço da clínica" },
] as const

export const DEFAULT_TEMPLATES: Record<TemplateType, PaperlessTemplate> = {
  dental_certificate: {
    type: "dental_certificate", name: "Atestado odontológico", description: "Modelo para comprovar atendimento e eventual necessidade de afastamento.",
    content: "Atesto, para os devidos fins, que {{paciente_nome}}, inscrito(a) no CPF {{paciente_cpf}}, esteve sob meus cuidados odontológicos no dia {{data_atendimento}}, necessitando de afastamento de suas atividades por ____ dia(s).\n\n{{clinica_nome}}\n{{clinica_endereco}}\n\n{{dentista_nome}} — CRO {{dentista_cro}}",
    questions: [],
  },
  dental_prescription: {
    type: "dental_prescription", name: "Receituário odontológico", description: "Estrutura-base para prescrição e orientações odontológicas.",
    content: "Paciente: {{paciente_nome}}\nData: {{data_atendimento}}\n\nUSO: ______________________________\n\n1. Medicamento / concentração: ______________________________\nQuantidade: ____________________\nPosologia: __________________________________________________\n\nOrientações: __________________________________________________\n\n{{dentista_nome}} — CRO {{dentista_cro}}\n{{clinica_nome}} — {{clinica_endereco}}",
    questions: [],
  },
  anamnesis: {
    type: "anamnesis", name: "Anamnese", description: "Questionário clínico padrão aplicado antes ou durante o atendimento.",
    content: "Anamnese odontológica de {{paciente_nome}}, realizada em {{data_atendimento}} por {{dentista_nome}}.",
    questions: [
      { id: "allergies", text: "Possui alguma alergia?", answerType: "yes_no", required: true },
      { id: "medications", text: "Utiliza medicamentos atualmente? Quais?", answerType: "text", required: true },
      { id: "diabetes", text: "Possui diabetes?", answerType: "yes_no", required: true },
      { id: "hypertension", text: "Possui hipertensão?", answerType: "yes_no", required: true },
      { id: "anticoagulants", text: "Faz uso de anticoagulantes?", answerType: "yes_no", required: true },
      { id: "anesthesia", text: "Já apresentou reação à anestesia?", answerType: "yes_no", required: true },
      { id: "pregnancy", text: "Está gestante?", answerType: "yes_no", required: false },
      { id: "surgeries", text: "Passou por cirurgia recentemente?", answerType: "yes_no", required: false },
    ],
  },
}
