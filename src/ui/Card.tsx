import type { ReactNode } from 'react'

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
    <section
      className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}
    >
      {title ? (
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">{title}</h2>
      ) : null}
      {children}
    </section>
  )
}
