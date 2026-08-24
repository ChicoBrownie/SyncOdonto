import type { SupabaseClient } from "@supabase/supabase-js"

export async function patientBelongsToClinic(
  supabase: SupabaseClient,
  patientId: unknown,
  ownerId: string,
): Promise<boolean> {
  if (typeof patientId !== "string" || !patientId) return false

  const { data, error } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("user_id", ownerId)
    .maybeSingle()

  return !error && Boolean(data)
}
