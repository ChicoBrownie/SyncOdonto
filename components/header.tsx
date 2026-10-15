"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return <header className="pointer-events-none absolute left-2 top-2 z-30 lg:hidden">
    <Button type="button" variant="ghost" size="icon" onClick={onMenuClick} className="pointer-events-auto h-11 w-11 rounded-full bg-background/90 text-primary shadow-sm" aria-label="Abrir menu">
      <Menu className="h-6 w-6" />
    </Button>
  </header>
}
