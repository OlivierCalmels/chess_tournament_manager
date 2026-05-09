import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'salon' | 'danger' | 'ghost'

const variants: Record<Variant, string> = {
  primary:
    'bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none',
  secondary:
    'bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50',
  salon:
    'border border-[oklch(0.52_0.07_52/0.55)] bg-[oklch(0.40_0.055_52)] text-[oklch(0.97_0.02_93)] shadow-[inset_0_1px_0_oklch(1_0_0/0.15)] hover:bg-[oklch(0.46_0.06_53)] disabled:pointer-events-none disabled:opacity-45',
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
