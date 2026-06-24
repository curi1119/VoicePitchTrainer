import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

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

/** ⓘ ボタン。タップで画面中央にヒントを表示する */
export function InfoTip({
  children,
}: {
  children: ReactNode
  /** @deprecated 無視される(後方互換のために残置) */
  placement?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onPointerDown={() => setOpen(false)}
        >
          <span
            className="border-line bg-panel2 text-ink block w-80 max-w-[85vw] rounded-lg border p-3 text-xs leading-relaxed shadow-lg"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {children}
          </span>
        </div>
      )}
    </>
  )
}
