import type { ReactNode } from 'react'

export function PageLayout({
  children,
  title,
}: {
  children: ReactNode
  title?: string
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-4 sm:max-w-5xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Tournoi suisse
            </p>
            {title ? (
              <h1 className="break-words text-lg font-semibold leading-snug text-zinc-900 sm:text-xl">
                {title}
              </h1>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:max-w-5xl">{children}</main>
    </div>
  )
}
