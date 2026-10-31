export async function checkAgendaBlockConflict(
  supabase: any,
  clinicId: string,
  date: string,
  time: string,
  durationMinutes: number,
  doctorName: string,
): Promise<boolean | null> {
  const { data, error } = await supabase.from("agenda_blocks").select("scope,doctor_name,date,start_time,end_time,all_day").eq("clinic_id", clinicId).eq("date", date)
  if (error) return error.code === "42P01" ? false : null
  const [hour, minute] = time.slice(0, 5).split(":").map(Number)
  const start = hour * 60 + minute
  const end = start + durationMinutes
  const doctor = doctorName.trim().toLocaleLowerCase("pt-BR")
  return (data || []).some((block: any) => {
    if (block.scope === "dentist" && block.doctor_name?.trim().toLocaleLowerCase("pt-BR") !== doctor) return false
    if (block.all_day) return true
    const blockStart = Number(block.start_time.slice(0, 2)) * 60 + Number(block.start_time.slice(3, 5))
    const blockEnd = Number(block.end_time.slice(0, 2)) * 60 + Number(block.end_time.slice(3, 5))
    return start < blockEnd && end > blockStart
  })
}
