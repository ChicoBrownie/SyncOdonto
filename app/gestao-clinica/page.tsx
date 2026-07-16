"use client"

import { AppLayout } from "@/components/app-layout"
import { ClinicManagementView } from "@/components/clinic/clinic-management-view"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function ClinicManagementPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) { router.push("/auth/login"); return }

      setAllowed(true)
    }
    check()
  }, [router])

  if (allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <AppLayout>
      <ClinicManagementView />
    </AppLayout>
  )
}