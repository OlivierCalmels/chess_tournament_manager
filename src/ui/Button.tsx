import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const variants: Record<Variant, string> = {
  primary:
    'bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none',
  secondary:
    'bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50',
  danger:
    'bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 disabled:pointer-events-none',
  ghost: 'text-zinc-700 hover:bg-zinc-100 disabled:opacity-50',
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: Variant
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
