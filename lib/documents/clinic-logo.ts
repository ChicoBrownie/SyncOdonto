export async function downloadClinicLogo(
  supabase: { storage: { from: (bucket: string) => { download: (path: string) => Promise<{ data: Blob | null; error: unknown }> } } },
  ownerId: string,
  path?: string | null,
): Promise<Buffer | undefined> {
  if (!path?.startsWith(`${ownerId}/branding/`) || !path.endsWith(".png")) return undefined
  const { data, error } = await supabase.storage.from("documentos-clinica").download(path)
  if (error || !data) return undefined
  return Buffer.from(await data.arrayBuffer())
}
