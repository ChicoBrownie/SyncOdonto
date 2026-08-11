"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileImage, FileText, Plus, Loader2, Trash2, Upload, X } from "lucide-react"
import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import useSWR from "swr"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { UniversalFileViewer } from "@/components/universal-file-viewer"
import { resolveViewerKind } from "@/components/universal-file-viewer/types"

interface AttachedExamsProps {
  patientId: string
}

interface Exam {
  id: string
  title: string
  exam_type: string
  file_url: string | null
  created_at: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Erro ao buscar exames")
  return res.json()
}

// Bucket privado no Supabase Storage. Precisa bater exatamente com o nome criado no dashboard.
const STORAGE_BUCKET = "documents"

// URL assinada válida por 1 ano. Se precisar que o link sempre reflita permissões atuais
// (ex: revogar acesso a um exame específico), gere a signed URL sob demanda no momento
// de exibir o arquivo em vez de salvar uma URL de validade longa no banco.
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 365

export function AttachedExams({ patientId }: AttachedExamsProps) {
  const { data, isLoading, mutate } = useSWR(`/api/documents?patient_id=${patientId}&document_type=exam`, fetcher)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewingExam, setViewingExam] = useState<Exam | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [examType, setExamType] = useState("Radiografia")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const exams: Exam[] = data?.data || []

  const handleAddExam = async () => {
    if (!title) {
      toast.error("Informe o nome do exame")
      return
    }

    setIsSaving(true)
    try {
      let fileUrl: string | null = null

      if (selectedFile) {
        const supabase = createClient()
        const fileExt = selectedFile.name.split(".").pop()
        const filePath = `exams/${patientId}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, selectedFile)

        if (uploadError) {
          // Falha real de upload agora é visível pro usuário, em vez de salvar o exame sem arquivo.
          throw new Error(`Falha ao enviar arquivo: ${uploadError.message}`)
        }

        // Bucket é privado (dado sensível de paciente), então usamos signed URL em vez de getPublicUrl.
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SECONDS)

        if (signedUrlError) {
          throw new Error(`Falha ao gerar link do arquivo: ${signedUrlError.message}`)
        }

        fileUrl = signedUrlData.signedUrl
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          title,
          document_type: "exam",
          signed: true,
          description: examType,
          file_url: fileUrl,
          file_type: selectedFile?.type || null,
          file_size: selectedFile?.size || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Erro ao salvar exame")
      }

      toast.success("Exame adicionado com sucesso!")
      mutate()
      setIsDialogOpen(false)
      setTitle("")
      setExamType("Radiografia")
      setSelectedFile(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar exame")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteExam = async (examId: string) => {
    try {
      const res = await fetch(`/api/documents?id=${examId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Erro ao remover")
      toast.success("Exame removido")
      mutate()
    } catch {
      toast.error("Erro ao remover exame")
    }
  }

  const getIcon = (type: string) => {
    if (type?.toLowerCase().includes("radiografia") || type?.toLowerCase().includes("imagem")) {
      return FileImage
    }
    return FileText
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Exames Anexados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : exams.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum exame anexado. Clique abaixo para adicionar.
          </p>
        ) : (
          exams.map((exam) => {
            const Icon = getIcon(exam.exam_type || (exam as any).description || "")
            return (
              <div key={exam.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                    <Icon className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{exam.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {(exam as any).description || exam.exam_type} - {new Date(exam.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {(exam as any).file_url && (
                    <Button
                      variant="link"
                      size="sm"
                      className="text-primary"
                      onClick={() => {
                        const url: string = (exam as any).file_url
                        const urlWithoutQuery = url.split("?")[0]
                        const kind = resolveViewerKind(urlWithoutQuery)
                        // Browsers already know how to render PDFs and images inline,
                        // so let those open in a normal tab. Everything else (STL/OBJ/PLY
                        // meshes, DICOM exams) has no native browser viewer and needs our
                        // own UniversalFileViewer, or the browser just force-downloads it.
                        if (kind === "document" || kind === "image") {
                          window.open(url, "_blank")
                        } else {
                          setViewingExam(exam)
                        }
                      }}
                    >
                      Ver
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteExam(exam.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })
        )}

        <Button
          variant="outline"
          className="w-full gap-2 bg-transparent"
          onClick={() => setIsDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Adicionar Exame
        </Button>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Adicionar Exame</DialogTitle>
              <DialogDescription>Registre um novo exame para este paciente.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="exam-title">Nome do Exame *</Label>
                <Input
                  id="exam-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Radiografia Panoramica"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="exam-type">Tipo</Label>
                <Select value={examType} onValueChange={setExamType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Radiografia">Radiografia</SelectItem>
                    <SelectItem value="Tomografia">Tomografia</SelectItem>
                    <SelectItem value="Hemograma">Hemograma</SelectItem>
                    <SelectItem value="Periapical">Periapical</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Arquivo (opcional)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff,.dcm,.dicom,.stl,.obj,.ply,.zip,.txt,.doc,.docx"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setSelectedFile(e.target.files[0])
                  }}
                />
                {selectedFile ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border p-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground flex-1 truncate">{selectedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setSelectedFile(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDraggingFile(true)
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsDraggingFile(false)
                      const dropped = e.dataTransfer.files?.[0]
                      if (dropped) setSelectedFile(dropped)
                    }}
                    className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                      isDraggingFile ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <p className="text-xs text-muted-foreground mb-2">
                      Arraste um arquivo aqui ou
                    </p>
                    <Button
                      variant="outline"
                      className="gap-2 bg-transparent"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      Selecionar Arquivo
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="bg-transparent" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddExam} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isSaving ? "Salvando..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewingExam} onOpenChange={(open) => !open && setViewingExam(null)}>
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle>{viewingExam?.title}</DialogTitle>
            </DialogHeader>
            <div style={{ width: "100%", height: 480 }}>
              {viewingExam?.file_url && (
                <UniversalFileViewer
                  file={viewingExam.file_url}
                  fileName={viewingExam.file_url.split("?")[0].split("/").pop()}
                  allowUpload={false}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
