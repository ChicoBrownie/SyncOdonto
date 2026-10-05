"use client"

import { useEffect, useState } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type PatientOption = { id: string; full_name: string; cpf?: string | null; phone?: string | null }

export function PatientCombobox({ value, onChange }: { value: PatientOption | null; onChange: (patient: PatientOption | null) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setError("")
      try {
        const response = await fetch(`/api/patients?limit=20&search=${encodeURIComponent(query)}`, { signal: controller.signal })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Não foi possível buscar pacientes.")
        setPatients(payload.data || [])
      } catch (error) {
        if (!controller.signal.aborted) { setPatients([]); setError(error instanceof Error ? error.message : "Não foi possível buscar pacientes.") }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="min-h-11 w-full justify-between bg-transparent font-normal">
          <span className="truncate">{value?.full_name || "Buscar por nome ou CPF..."}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Digite nome ou CPF..." />
          <CommandList>
            {loading && <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>}
            {error && <p role="alert" className="p-3 text-sm text-destructive">{error}</p>}
            {!loading && !error && <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>}
            <CommandGroup>
              {patients.map((patient) => (
                <CommandItem key={patient.id} value={patient.id} onSelect={() => { onChange(patient); setOpen(false) }}>
                  <Check className={cn("h-4 w-4", value?.id === patient.id ? "opacity-100" : "opacity-0")} />
                  <span>{patient.full_name}</span>
                  {patient.cpf && <span className="ml-auto text-xs text-muted-foreground">{patient.cpf}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
