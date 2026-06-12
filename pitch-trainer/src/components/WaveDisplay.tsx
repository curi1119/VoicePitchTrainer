import { useImperativeHandle, useRef, type Ref } from 'react'

export interface WaveHandle {
  /** マイク入力波形を描画する(毎フレーム呼ぶ) */
  draw(buf: Float32Array): void
}

export function WaveDisplay({ ref }: { ref?: Ref<WaveHandle> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      draw(buf) {
        const canvas = canvasRef.current
        if (!canvas) return
        ctxRef.current ??= canvas.getContext('2d')
        const c = ctxRef.current
        if (!c) return
        const w = (canvas.width = canvas.clientWidth)
        const h = (canvas.height = canvas.clientHeight)
        c.clearRect(0, 0, w, h)
        c.strokeStyle = '#6bb8ff'
        c.lineWidth = 1.2
        c.beginPath()
        for (let i = 0; i < buf.length; i++) {
          const x = (i / buf.length) * w
          const y = h / 2 + buf[i] * h * 0.9
          if (i) c.lineTo(x, y)
          else c.moveTo(x, y)
        }
        c.stroke()
      },
    }),
    [],
  )

  return <canvas ref={canvasRef} className="bg-panel2 mt-3 block h-[54px] w-full rounded-lg" />
}
