"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Pill, HeartPulse } from "lucide-react"
import { usePatient } from "@/lib/hooks/use-data"
import { Loader2, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

interface MedicalInformationProps {
  patientId: string
}

export function MedicalInformation({ patientId }: MedicalInformationProps) {
  const { patient, isLoading, mutate } = usePatient(patientId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [allergiesInput, setAllergiesInput] = useState("")
  const [conditionsInput, setConditionsInput] = useState("")
  const [medicationsInput, setMedicationsInput] = useState("")
  const [saving, setSaving] = useState(false)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const allergies = patient?.allergies?.split(",").map((a: string) => a.trim()).filter(Boolean) || []
  const conditions = patient?.pre_existing_conditions?.split(",").map((c: string) => c.trim()).filter(Boolean) || []
  const medications = patient?.medications?.split(",").map((m: string) => m.trim()).filter(Boolean) || []

  const hasAnyInfo = allergies.length > 0 || conditions.length > 0 || medications.length > 0

  const openEditor = () => {
    setAllergiesInput(patient?.allergies || "")
    setConditionsInput(patient?.pre_existing_conditions || "")
    setMedicationsInput(patient?.medications || "")
    setDialogOpen(true)
  }

  const saveMedicalInformation = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allergies: allergiesInput.trim() || null,
          pre_existing_conditions: conditionsInput.trim() || null,
          medications: medicationsInput.trim() || null,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar as informações médicas.")
      await mutate()
      setDialogOpen(false)
      toast.success("Informações médicas atualizadas.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar as informações médicas.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Informações médicas</CardTitle>
        <Button variant="outline" size="sm" onClick={openEditor}><>{hasAnyInfo ? <Pencil className="mr-1.5 h-3.5 w-3.5" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}</>{hasAnyInfo ? "Editar" : "Adicionar"}</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAnyInfo && <p className="py-3 text-center text-sm text-muted-foreground">Nenhuma informação médica registrada.</p>}
        {allergies.length > 0 && (
          <div>
            <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Alergias
            </p>
            <div className="flex flex-wrap gap-2">
              {allergies.map((allergy: string) => (
                <Badge key={allergy} variant="destructive">
                  {allergy}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {conditions.length > 0 && (
          <div>
            <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <HeartPulse className="h-4 w-4 text-warning" />
              Condicoes Pre-existentes
            </p>
            <div className="flex flex-wrap gap-2">
              {conditions.map((condition: string) => (
                <Badge key={condition} variant="secondary" className="bg-warning/10 text-warning hover:bg-warning/20">
                  {condition}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {medications.length > 0 && (
          <div>
            <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <Pill className="h-4 w-4 text-primary" />
              Medicamentos em Uso
            </p>
            <div className="flex flex-wrap gap-2">
              {medications.map((med: string) => (
                <Badge key={med} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                  {med}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Informações médicas</DialogTitle><DialogDescription>Separe os itens por vírgula para facilitar a leitura no prontuário.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="medical-allergies">Alergias</Label><Input id="medical-allergies" value={allergiesInput} onChange={(event) => setAllergiesInput(event.target.value)} placeholder="Ex.: penicilina, látex" /></div>
            <div className="space-y-2"><Label htmlFor="medical-conditions">Condições preexistentes</Label><Input id="medical-conditions" value={conditionsInput} onChange={(event) => setConditionsInput(event.target.value)} placeholder="Ex.: diabetes, hipertensão" /></div>
            <div className="space-y-2"><Label htmlFor="medical-medications">Medicamentos em uso</Label><Input id="medical-medications" value={medicationsInput} onChange={(event) => setMedicationsInput(event.target.value)} placeholder="Ex.: metformina" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={saveMedicalInformation} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
