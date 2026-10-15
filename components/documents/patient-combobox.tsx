"use client"

import { useEffect, useState } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type PatientOption = { id: string; full_name: string; cpf?: string | null; phone?: string | null }

export function PatientCombobox({ value, onChange, inline = false, onCreateNew, quickEntry = false, disabled = false }: { value: PatientOption | null; onChange: (patient: PatientOption | null) => void; inline?: boolean; onCreateNew?: (query: string) => void; quickEntry?: boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [resultsQuery, setResultsQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const cpfQuery = quickEntry && /^\s*[\d.\-\s]+$/.test(query)
  const searchTerm = cpfQuery ? query.replace(/\D/g, "") : query
  const enoughToSearch = !quickEntry || searchTerm.trim().length >= (cpfQuery ? 3 : 2)

  useEffect(() => {
    if (!enoughToSearch) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setError("")
      try {
        const response = await fetch(`/api/patients?limit=20&${cpfQuery ? "cpf" : "search"}=${encodeURIComponent(searchTerm)}`, { signal: controller.signal })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Não foi possível buscar pacientes.")
        setPatients(payload.data || [])
        setResultsQuery(query)
      } catch (error) {
        if (!controller.signal.aborted) { setPatients([]); setResultsQuery(query); setError(error instanceof Error ? error.message : "Não foi possível buscar pacientes.") }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [cpfQuery, enoughToSearch, query, searchTerm])

  const ready = resultsQuery === query && !loading && !error
  if (inline) return <div className="space-y-2">
    <Input aria-label={quickEntry ? "Buscar paciente por CPF ou nome" : "Buscar paciente por nome ou CPF"} placeholder={quickEntry ? "Digite o CPF ou nome" : "Buscar por nome ou CPF..."} value={query} disabled={disabled} onChange={event => { setQuery(event.target.value); if (value) onChange(null) }} autoComplete="off" />
    {!value && !disabled && query.trim() && enoughToSearch && <div className="max-h-48 overflow-y-auto rounded-md border bg-card p-1" aria-label="Resultados da busca de pacientes">
      {!ready && !error && <p role="status" className="p-2 text-sm">Buscando pacientes…</p>}
      {error && <p role="alert" className="p-2 text-sm text-destructive">{error}</p>}
      {!quickEntry && ready && patients.length === 0 && <p className="p-2 text-sm text-muted-foreground">Nenhum paciente encontrado.</p>}
      {ready && patients.map(patient => <button type="button" key={patient.id} disabled={disabled} className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm hover:bg-muted focus-visible:outline-primary ${quickEntry ? "border border-primary/20 bg-primary/5" : ""}`} onClick={() => { onChange(patient); if (!quickEntry) setQuery(patient.full_name) }}><span className="font-semibold">{patient.full_name}</span><span className="text-xs text-muted-foreground">{patient.cpf}</span></button>)}
      {onCreateNew && ready && (!quickEntry || patients.length === 0) && <Button type="button" data-guide="quick-register" variant="outline" className="mt-1 min-h-11 w-full" disabled={disabled} onClick={() => onCreateNew(query.trim())}>+ Novo paciente com {cpfQuery ? "este CPF" : "este nome"}</Button>}
    </div>}
  </div>

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
