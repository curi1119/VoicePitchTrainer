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

/**
 * ⓘ ボタン。タップでヒントをポップオーバー表示する(レイアウトを押し下げない)。
 * placement:
 *  - 'top-right'(既定): ボタン右端を基準に上方向へ開く。右寄せ(`ml-auto`)で置く場面向け
 *  - 'bottom-center': ボタン中央を基準に下方向へ開く。画面上部や中央寄りに置く場面向け(端での見切れ防止)
 */
export function InfoTip({
  children,
  placement = 'top-right',
}: {
  children: ReactNode
  placement?: 'top-right' | 'bottom-center'
}) {
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

  const popoverPos =
    placement === 'bottom-center'
      ? 'top-full left-1/2 mt-1.5 -translate-x-1/2'
      : 'right-0 bottom-full mb-1.5'

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
        <span
          className={`border-line bg-panel2 text-ink absolute z-30 block w-80 max-w-[85vw] rounded-lg border p-3 text-xs leading-relaxed shadow-lg ${popoverPos}`}
        >
          {children}
        </span>
      )}
    </span>
  )
}
