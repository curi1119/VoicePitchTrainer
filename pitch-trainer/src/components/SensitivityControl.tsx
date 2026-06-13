import { useEffect, useRef, useState } from 'react'

interface SensitivityControlProps {
  /** 感度 0..1(0=鈍感 … 1=敏感) */
  sensitivity: number
  onChange(sensitivity: number): void
}

/** 0..1 を 5段階の目安ラベルに */
function label(s: number): string {
  if (s < 0.2) return '鈍感'
  if (s < 0.4) return 'やや鈍感'
  if (s < 0.6) return '標準'
  if (s < 0.8) return 'やや敏感'
  return '敏感'
}

/**
 * ヘッダーのマイク感度つまみ。VolumeControl と同じ方式:
 * スマホはボタン+幅広スライダーのポップオーバー、sm 以上はインライン。
 * 敏感(右)ほど小さな声を拾うがノイズも拾いやすい。
 */
export function SensitivityControl({ sensitivity, onChange }: SensitivityControlProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const slider = (cls: string) => (
    <input
      aria-label="マイク感度"
      type="range"
      className={cls}
      min={0}
      max={1}
      step={0.02}
      value={sensitivity}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )

  return (
    <>
      {/* スマホ: ボタン + ポップオーバー */}
      <span ref={wrapRef} className="relative inline-flex sm:hidden">
        <button
          type="button"
          aria-label="マイク感度を調整"
          aria-expanded={open}
          className="border-line bg-panel2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border text-[13px]"
          onClick={() => setOpen((v) => !v)}
        >
          🎙
        </button>
        {open && (
          <span className="border-line bg-panel2 fixed inset-x-2 top-12 z-30 flex items-center gap-3 rounded-lg border p-3 shadow-lg">
            <span className="text-ink-dim shrink-0 text-xs">感度</span>
            {slider('min-w-0 flex-1 touch-none accent-amber')}
            <span className="text-ink-dim w-16 shrink-0 text-right font-mono text-xs">
              {label(sensitivity)}
            </span>
          </span>
        )}
      </span>
      {/* PC / タブレット: インライン */}
      <span
        className="hidden items-center gap-1 sm:flex"
        title="マイク感度。敏感ほど小さい声を拾うがノイズも拾いやすくなります"
      >
        <span aria-hidden className="text-xs">
          🎙
        </span>
        {slider('w-20 touch-none accent-amber')}
      </span>
    </>
  )
}
