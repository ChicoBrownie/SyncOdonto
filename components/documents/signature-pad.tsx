"use client"

import { useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Eraser } from "lucide-react"

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void
}

export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.strokeStyle = "#000000"
  }, [])

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !e.isPrimary) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    hasInk.current = true
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    if (canvasRef.current && hasInk.current) {
      onChange(canvasRef.current.toDataURL("image/png"))
    }
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawing.current = false
    hasInk.current = false
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={180}
          className="w-full touch-none rounded-lg"
          style={{ height: 180 }}
          aria-label="Campo para desenhar a assinatura com o dedo, caneta ou mouse"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onLostPointerCapture={end}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Assine com o dedo ou o mouse no campo acima.</p>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 bg-transparent" onClick={clear}>
          <Eraser className="h-3.5 w-3.5" />
          Limpar
        </Button>
      </div>
    </div>
  )
}
