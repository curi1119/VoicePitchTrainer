import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean
  small?: boolean
}

export function Button({ primary = false, small = false, className = '', ...rest }: ButtonProps) {
  const cls = [
    'cursor-pointer rounded-lg border whitespace-nowrap disabled:cursor-default disabled:opacity-40',
    small ? 'px-2.5 py-[5px] text-xs' : 'px-3.5 py-2 text-sm',
    primary
      ? 'border-amber bg-amber font-semibold text-[#1a1410]'
      : 'border-line bg-panel2 text-ink enabled:hover:border-amber',
    className,
  ].join(' ')
  return <button className={cls} {...rest} />
}

export function Card({
  title,
  children,
  className = 'p-3.5',
}: {
  title?: string
  children: ReactNode
  /** padding はデフォルト p-3.5。className を指定する場合は padding も含めて指定する */
  className?: string
}) {
  return (
    <div className={`border-line bg-panel rounded-xl border ${className}`}>
      {title != null && (
        <h2 className="text-ink-dim mb-2.5 text-xs font-semibold tracking-[0.15em] uppercase">
          {title}
        </h2>
      )}
      {children}
    </div>
  )
}

/** ⓘ ボタン。タップでヒントをポップオーバー表示する(レイアウトを押し下げない) */
export function InfoTip({ children }: { children: ReactNode }) {
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

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        aria-label="使い方"
        aria-expanded={open}
        className="border-line bg-panel2 text-ink-dim hover:border-amber flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border text-[13px]"
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <span className="border-line bg-panel2 text-ink absolute right-0 bottom-full z-30 mb-1.5 block w-80 max-w-[85vw] rounded-lg border p-3 text-xs leading-relaxed shadow-lg">
          {children}
        </span>
      )}
    </span>
  )
}
