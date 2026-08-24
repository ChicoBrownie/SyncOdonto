const MAX_FILE_BYTES = 15 * 1024 * 1024
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"]

export async function prepareDocumentFile(file: File): Promise<File> {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Use um arquivo PDF, PNG ou JPG.")
  if (file.size > MAX_FILE_BYTES) throw new Error("O arquivo deve ter no máximo 15 MB.")
  if (!file.type.startsWith("image/") || file.size < 800_000) return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext("2d")
  if (!context) return file
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82))
  if (!blob || blob.size >= file.size) return file
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })
}
