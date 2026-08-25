"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Camera, FileImage, FileText, Plus, Loader2, Mail, Trash2, Upload, X } from "lucide-react"
import { useEffect, useState, useRef } from "react"
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
  storage_path?: string | null
  created_at: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Erro ao buscar exames")
  return res.json()
}

// Bucket privado no Supabase Storage. Precisa bater exatamente com o nome criado no dashboard.
const STORAGE_BUCKET = "documentos-clinica"

export function AttachedExams({ patientId }: AttachedExamsProps) {
  const { data, isLoading, mutate } = useSWR(`/api/documents?patient_id=${patientId}&document_type=exam`, fetcher)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewingExam, setViewingExam] = useState<Exam | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [examType, setExamType] = useState("Radiografia")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const exams: Exam[] = data?.data || []

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      void videoRef.current.play()
    }
  }, [cameraOpen])

  const startCamera = async () => {
    setCameraLoading(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      streamRef.current = stream
      setCameraOpen(true)
    } catch {
      toast.error("Não foi possível abrir a câmera. Conecte a SKYcam e permita o acesso no navegador.")
    } finally { setCameraLoading(false) }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video?.videoWidth) return toast.error("A imagem da câmera ainda não está pronta.")
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext("2d")?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return toast.error("Não foi possível capturar a imagem.")
      setSelectedFile(new File([blob], `foto-intraoral-${Date.now()}.jpg`, { type: "image/jpeg" }))
      setTitle((value) => value || "Fotografia intraoral")
      setExamType("Fotografia intraoral")
      stopCamera()
      toast.success("Imagem capturada. Revise e clique em Adicionar.")
    }, "image/jpeg", 0.92)
  }

  const sendExam = async (exam: Exam) => {
    setSendingId(exam.id)
    try {
      const response = await fetch(`/api/documents/${exam.id}/email`, { method: "POST" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar o exame")
      toast.success(result.message || "Exame enviado ao paciente.")
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao enviar exame") }
    finally { setSendingId(null) }
  }

  const openExam = async (exam: Exam) => {
    try {
      const response = await fetch(`/api/documents/${exam.id}/signed-url`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Não foi possível abrir o arquivo")
      const url: string = result.data?.url
      if (!url) throw new Error("O arquivo não possui um link disponível")
      const kind = resolveViewerKind(url.split("?")[0])
      if (kind === "document" || kind === "image") window.open(url, "_blank", "noopener,noreferrer")
      else setViewingExam({ ...exam, file_url: url })
    } catch (error) { toast.error(error instanceof Error ? error.message : "Erro ao abrir arquivo") }
  }

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
        const { data: authData } = await supabase.auth.getUser()
        if (!authData.user) throw new Error("Sessão expirada. Entre novamente.")
        const fileExt = selectedFile.name.split(".").pop()
        const filePath = `${authData.user.id}/${patientId}/${crypto.randomUUID()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, selectedFile)

        if (uploadError) {
          // Falha real de upload agora é visível pro usuário, em vez de salvar o exame sem arquivo.
          throw new Error(`Falha ao enviar arquivo: ${uploadError.message}`)
        }

        fileUrl = filePath
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
          storage_path: fileUrl,
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
                  {((exam as any).storage_path || (exam as any).file_url) && (
                    <Button
                      variant="link"
                      size="sm"
                      className="text-primary"
                      onClick={() => openExam(exam)}
                    >
                      Ver
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" title="Enviar ao e-mail do paciente" disabled={sendingId === exam.id || !(exam.storage_path || exam.file_url)} onClick={() => sendExam(exam)}>
                    {sendingId === exam.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  </Button>
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
                    <SelectItem value="Fotografia intraoral">Fotografia intraoral</SelectItem>
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
                <Button type="button" variant="outline" className="w-full gap-2" disabled={cameraLoading} onClick={startCamera}>
                  {cameraLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  Capturar com câmera intraoral
                </Button>
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

        <Dialog open={cameraOpen} onOpenChange={(open) => { if (!open) stopCamera() }}>
          <DialogContent className="sm:max-w-[820px]">
            <DialogHeader><DialogTitle>Câmera intraoral</DialogTitle><DialogDescription>Selecione a SKYcam no aviso do navegador, posicione a câmera e capture a imagem.</DialogDescription></DialogHeader>
            <div className="overflow-hidden rounded-lg bg-black"><video ref={videoRef} autoPlay playsInline muted className="max-h-[60vh] w-full object-contain" /></div>
            <DialogFooter><Button variant="outline" onClick={stopCamera}>Cancelar</Button><Button onClick={capturePhoto} className="gap-2"><Camera className="h-4 w-4" />Capturar imagem</Button></DialogFooter>
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
