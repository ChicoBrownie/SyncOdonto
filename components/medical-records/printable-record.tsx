interface PrintableRecordProps {
  patient: any
  age: number | null
  anamneses: any[]
  clinicalRecords: any[]
  exams: any[]
}

export function PrintableRecord({ patient, age, anamneses, clinicalRecords, exams }: PrintableRecordProps) {
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

      <footer className="mt-10 pt-4 border-t border-black text-xs text-center">
        Documento gerado pelo SyncOdonto
      </footer>
    </div>
  )
}
