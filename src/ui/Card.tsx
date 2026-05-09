import type { ReactNode } from 'react'

export function Card({
  title,
  titleClassName = '',
  tone = 'default',
  children,
  className = '',
}: {
  title?: string
  titleClassName?: string
  /** `salon` : parchemin bordée bois (page classement). */
  tone?: 'default' | 'salon'
  children: ReactNode
  className?: string
}) {
  const shell =
    tone === 'salon' ?
      'salon-board-card p-4 sm:p-6'
    : 'rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6'
  const heading =
    tone === 'salon' ?
      'font-display text-[1.15rem] font-semibold text-[oklch(0.28_0.03_55)] sm:text-xl'
    : 'text-lg font-semibold text-zinc-900'

  return (
    <section className={`${shell} ${className}`}>
      {title ? (
        <h2 className={`mb-4 ${heading} ${titleClassName}`}>{title}</h2>
      ) : null}
      {children}
    </section>
  )
}

