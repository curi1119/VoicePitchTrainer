import { useEffect, useRef, useState } from 'react'

interface VolumeControlProps {
  /** マスター音量 0..1 */
  volume: number
  onChange(volume: number): void
}

/**
 * ヘッダーの音量つまみ。
 * スマホでは小さなインラインスライダーが操作困難(+ドラッグがスクロールに横取りされる)
 * だったため、ボタン → 幅広スライダーのポップオーバー方式にする。sm 以上はインライン表示。
 */
export function VolumeControl({ volume, onChange }: VolumeControlProps) {
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
      aria-label="音量"
      type="range"
      className={cls}
      min={0}
      max={1}
      step={0.05}
      value={volume}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )

  return (
    <>
      {/* スマホ: ボタン + ポップオーバー */}
      <span ref={wrapRef} className="relative inline-flex sm:hidden">
        <button
          type="button"
          aria-label="音量を調整"
          aria-expanded={open}
          className="border-line bg-panel2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border text-[13px]"
          onClick={() => setOpen((v) => !v)}
        >
          🔊
        </button>
        {open && (
          // 画面幅いっぱいの固定バー(ボタン基準の absolute だと画面左へはみ出すため)
          <span className="border-line bg-panel2 fixed inset-x-2 top-12 z-30 flex items-center gap-3 rounded-lg border p-3 shadow-lg">
            {/* touch-none: ドラッグが画面スクロールに奪われないようにする */}
            {slider('min-w-0 flex-1 touch-none accent-amber')}
            <span className="text-ink-dim w-10 shrink-0 text-right font-mono text-xs">
              {Math.round(volume * 100)}%
            </span>
          </span>
        )}
      </span>
      {/* PC / タブレット: インライン */}
      <span className="hidden items-center gap-1 sm:flex">
        <span aria-hidden className="text-xs">
          🔊
        </span>
        {slider('w-24 touch-none accent-amber')}
      </span>
    </>
  )
}
