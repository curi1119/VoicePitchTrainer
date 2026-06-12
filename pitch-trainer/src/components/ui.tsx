import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean
  small?: boolean
}

export function Button({ primary = false, small = false, className = '', ...rest }: ButtonProps) {
  const cls = [
    'cursor-pointer rounded-lg border disabled:cursor-default disabled:opacity-40',
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
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`border-line bg-panel mb-3.5 rounded-xl border p-3.5 ${className}`}>
      {title != null && (
        <h2 className="text-ink-dim mb-2.5 text-xs font-semibold tracking-[0.15em] uppercase">
          {title}
        </h2>
      )}
      {children}
    </div>
  )
}
