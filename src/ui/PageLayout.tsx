import type { ReactNode } from 'react'

export function PageLayout({
  children,
  title,
  surface = 'default',
}: {
  children: ReactNode
  title?: string
  /** `salon` : en-tête bois + zone principale feutre (classement). */
  surface?: 'default' | 'salon'
}) {
  if (surface === 'salon') {
    return (
      <div className="salon-shell">
        <header className="salon-header">
          <div className="salon-header-chess">
            <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-5 sm:max-w-5xl sm:flex-row sm:items-center sm:justify-between sm:py-6">
              <div className="relative z-[1]">
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none text-amber-200/85" aria-hidden>
                    ♟
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/65">
                    Classement
                  </p>
                </div>
                {title ? (
                  <h1 className="font-display mt-1.5 max-w-[min(100%,28rem)] break-words text-[1.35rem] leading-snug font-semibold text-[#fdf6e9] [text-shadow:0_1px_3px_rgb(0_0_0_/0.35)] sm:max-w-none sm:text-2xl sm:leading-tight">
                    {title}
                  </h1>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        <main className="salon-main mx-auto max-w-3xl px-4 py-6 sm:max-w-5xl sm:px-5 sm:py-8">
          {children}
        </main>
      </div>
    )
  }

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
