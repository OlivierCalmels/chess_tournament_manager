import type { LabelHTMLAttributes, ReactNode } from 'react'

export function Label({
  children,
  className = '',
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }) {
  return (
    <label
      className={`mb-1 block text-sm font-medium text-zinc-700 ${className}`}
      {...props}
    >
      {children}
    </label>
  )
}
