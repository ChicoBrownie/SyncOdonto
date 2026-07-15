"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import useSWR from "swr"
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileStack,
  Building2,
  BarChart3,
  Leaf,
  X,
  DollarSign,
} from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Lista de Pacientes", href: "/pacientes" },
  { icon: Calendar, label: "Agenda Inteligente", href: "/agenda" },
  { icon: FileStack, label: "Gestão Paperless", href: "/gestao-paperless" },
  { icon: Building2, label: "Gestão da Clínica", href: "/gestao-clinica" },
  { icon: BarChart3, label: "Relatórios", href: "/relatorios" },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
  desktop?: boolean
}

export function Sidebar({ isOpen, onClose, desktop = false }: SidebarProps) {
  const pathname = usePathname()

  if (desktop) {
    // Versão desktop: sem fixed, sem overlay, sempre visível
    return (
      <aside className="w-64 h-full bg-card border-r border-border flex flex-col">
        <SidebarContent pathname={pathname} onClose={() => {}} showClose={false} />
      </aside>
    )
  }

  // Versão mobile: overlay com animação
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 bg-card border-r border-border transition-transform duration-300 flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent pathname={pathname} onClose={onClose!} showClose={true} />
      </aside>
    </>
  )
}

function SidebarContent({
  pathname,
  onClose,
  showClose,
}: {
  pathname: string
  onClose: () => void
  showClose: boolean
}) {
  const { data: accessRes } = useSWR("/api/auth/check-access", fetcher)
  const isGestor = (accessRes?.access_role || "gestor") === "gestor"

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary overflow-hidden">
            <img
              src="/icon.png"
              alt="SyncOdonto"
              className="h-8 w-8 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none"
              }}
            />
          </div>
          <span className="text-lg font-semibold text-foreground">SyncOdonto</span>
        </div>
        {showClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Sustainability indicator */}
      {isGestor && (
        <div className="border-t border-border p-4">
          <div className="flex items-start gap-3 rounded-lg bg-success/10 p-3">
            <Leaf className="h-5 w-5 text-success mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-success">Impacto Sustentável</p>
              <p className="text-xs text-muted-foreground mt-1">
                Este mês você economizou{" "}
                <span className="font-semibold text-foreground">2.847 folhas de papel</span>{" "}
                🌱
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}