import type { ReactNode } from 'react'

export function Table({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full border-collapse text-left text-sm">{children}</table>
    </div>
  )
}

export function Th({
  children,
  className = '',
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <th
      className={`border-b border-zinc-200 bg-zinc-50 px-3 py-2 font-medium text-zinc-800 ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className = '',
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <td className={`border-b border-zinc-100 px-3 py-2 text-zinc-800 ${className}`}>
      {children}
    </td>
  )
}
