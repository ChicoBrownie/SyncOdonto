import { type ToothCondition } from "@/components/dental-chart/dental-chart"

interface PrintableRecordProps {
  patient: any
  age: number | null
  anamneses: any[]
  clinicalRecords: any[]
  exams: any[]
  toothData?: Record<number, ToothCondition>
  consents?: any[]
}

const CONDITION_ABBR: Record<ToothCondition, string> = {
  "Sem Registros": "",
  "Saudável": "S",
  "Restaurado": "R",
  "Atenção/Cárie": "C",
  "Tratamento Canal": "TC",
  "Ausente": "X",
  "Implante": "IMP",
}

const CONDITION_LABELS: { value: ToothCondition; label: string }[] = [
  { value: "Saudável", label: "S = Saudável" },
  { value: "Restaurado", label: "R = Restaurado" },
  { value: "Atenção/Cárie", label: "C = Cárie" },
  { value: "Tratamento Canal", label: "TC = Tratamento de Canal" },
  { value: "Ausente", label: "X = Ausente" },
  { value: "Implante", label: "IMP = Implante" },
]

function ToothBox({ number, toothData }: { number: number; toothData: Record<number, ToothCondition> }) {
  const condition = toothData[number] || "Sem Registros"
  const abbr = CONDITION_ABBR[condition]
  const isMissing = condition === "Ausente"

  return (
    <div className="flex flex-col items-center">
      <div
        className={`flex h-7 w-7 items-center justify-center border text-[9px] font-bold ${
          isMissing ? "border-dashed" : "border-solid"
        } border-black ${isMissing ? "line-through text-gray-500" : ""}`}
      >
        {number}
      </div>
      <div className="mt-0.5 h-3 text-[8px] font-semibold">{abbr}</div>
    </div>
  )
}

function ToothRow({ numbers, toothData }: { numbers: number[]; toothData: Record<number, ToothCondition> }) {
  return (
    <div className="flex gap-1">
      {numbers.map((n) => (
        <ToothBox key={n} number={n} toothData={toothData} />
      ))}
    </div>
  )
}

export function PrintableRecord({ patient, age, anamneses, clinicalRecords, exams, toothData = {}, consents = [] }: PrintableRecordProps) {
  const upperRight = [18, 17, 16, 15, 14, 13, 12, 11]
  const upperLeft = [21, 22, 23, 24, 25, 26, 27, 28]
  const lowerRight = [48, 47, 46, 45, 44, 43, 42, 41]
  const lowerLeft = [31, 32, 33, 34, 35, 36, 37, 38]

  const registeredCount = Object.keys(toothData).length

  return (
    <div id="printable-record" className="hidden print:block p-8 text-black">
      <div className="mb-6 border-b-2 border-black pb-4">
        <h1 className="text-2xl font-bold">Prontuário Odontológico</h1>
        <p className="text-sm mt-1">Emitido em {new Date().toLocaleDateString("pt-BR")}</p>
      </div>

      <section className="mb-6">
        <h2 className="text-lg font-semibold border-b border-black mb-2">Dados do Paciente</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p><strong>Nome:</strong> {patient.full_name}</p>
          <p><strong>Idade:</strong> {age ? `${age} anos` : "-"}</p>
          <p><strong>Telefone:</strong> {patient.phone || "-"}</p>
          <p><strong>Email:</strong> {patient.email || "-"}</p>
          <p><strong>Alergias:</strong> {patient.allergies || "Nenhuma registrada"}</p>
          <p><strong>Condições pré-existentes:</strong> {patient.pre_existing_conditions || "Nenhuma registrada"}</p>
          <p className="col-span-2"><strong>Medicamentos em uso:</strong> {patient.medications || "Nenhum registrado"}</p>
        </div>
      </section>

      <section className="mb-6 break-inside-avoid">
        <h2 className="text-lg font-semibold border-b border-black mb-2">Mapa Odontológico</h2>
        {registeredCount === 0 ? (
          <p className="text-sm">Nenhum registro no mapa odontológico.</p>
        ) : (
          <>
            <div className="flex flex-col items-center gap-1 py-2">
              <p className="text-[9px] text-gray-600">Arcada Superior</p>
              <div className="flex gap-4">
                <ToothRow numbers={upperRight} toothData={toothData} />
                <ToothRow numbers={upperLeft} toothData={toothData} />
              </div>
              <div className="my-1 h-px w-full bg-black" />
              <div className="flex gap-4">
                <ToothRow numbers={lowerRight} toothData={toothData} />
                <ToothRow numbers={lowerLeft} toothData={toothData} />
              </div>
              <p className="text-[9px] text-gray-600">Arcada Inferior</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-gray-700">
              {CONDITION_LABELS.map((c) => (
                <span key={c.value}>{c.label}</span>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold border-b border-black mb-2">Anamnese</h2>
        {anamneses.length === 0 ? (
          <p className="text-sm">Nenhuma anamnese registrada.</p>
        ) : (
          anamneses.map((a) => (
            <div key={a.id} className="mb-4 break-inside-avoid">
              <p className="text-sm font-medium">
                {a.chief_complaint || "Anamnese"} — {new Date(a.created_at).toLocaleDateString("pt-BR")}
                {a.dentist_name ? ` · Dr(a). ${a.dentist_name}` : ""}
              </p>
              <ul className="text-sm mt-1 pl-4 list-disc">
                {a.answers?.filter((ans: any) => ans.answer === "sim").map((ans: any) => (
                  <li key={ans.question}>
                    {ans.question}{ans.observation ? ` — ${ans.observation}` : ""}
                  </li>
                ))}
              </ul>
              {a.diagnosis && <p className="text-sm mt-1"><strong>Diagnóstico:</strong> {a.diagnosis}</p>}
              {a.treatment_plan && <p className="text-sm mt-1"><strong>Plano de Tratamento:</strong> {a.treatment_plan}</p>}
              {a.additional_notes && <p className="text-sm mt-1"><strong>Obs.:</strong> {a.additional_notes}</p>}
            </div>
          ))
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold border-b border-black mb-2">Histórico Clínico</h2>
        {clinicalRecords.length === 0 ? (
          <p className="text-sm">Nenhum registro clínico.</p>
        ) : (
          clinicalRecords.map((r) => (
            <div key={r.id} className="mb-3 break-inside-avoid text-sm">
              <p className="font-medium">
                {r.title} — {r.record_date ? new Date(r.record_date).toLocaleDateString("pt-BR") : new Date(r.created_at).toLocaleDateString("pt-BR")}
                {r.doctor_name ? ` · ${r.doctor_name}` : ""}
              </p>
              {r.description && <p>{r.description}</p>}
            </div>
          ))
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold border-b border-black mb-2">Exames Anexados</h2>
        {exams.length === 0 ? (
          <p className="text-sm">Nenhum exame anexado.</p>
        ) : (
          <ul className="text-sm pl-4 list-disc">
            {exams.map((e) => (
              <li key={e.id}>
                {e.title} ({e.description || e.exam_type}) — {new Date(e.created_at).toLocaleDateString("pt-BR")}
              </li>
            ))}
          </ul>
        )}
      </section>
      
      <section className="mb-6 break-inside-avoid">
        <h2 className="text-lg font-semibold border-b border-black mb-2">Termo de Consentimento (TCLE)</h2>
        {consents.length === 0 ? (
          <p className="text-sm">Nenhum TCLE assinado.</p>
        ) : (
          consents.map((c) => (
            <div key={c.id} className="mb-4 break-inside-avoid">
              <p className="text-sm">
                {c.description || "TCLE assinado"} — {c.signed_at ? new Date(c.signed_at).toLocaleDateString("pt-BR") : "-"}
              </p>
              {c.signature_data && (
                <div className="mt-1 border border-black inline-block p-1">
                  <img src={c.signature_data} alt="Assinatura" className="h-16" />
                </div>
              )}
            </div>
          ))
        )}
      </section>

      <footer className="mt-10 pt-4 border-t border-black text-xs text-center"></footer>

      <footer className="mt-10 pt-4 border-t border-black text-xs text-center">
        Documento gerado pelo SyncOdonto
      </footer>
    </div>
  )
}
