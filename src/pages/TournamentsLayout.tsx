import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { isSpectatorMode } from '../config'
import { useTournament } from '../context/useTournament'

function tabClass({ isActive }: { isActive: boolean }) {
  return `rounded-md px-4 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/80'
      : 'text-zinc-600 hover:text-zinc-900'
  }`
}

export function TournamentsLayout() {
  const { pathname } = useLocation()
  const { state } = useTournament()

  const onTournamentView =
    pathname.endsWith('/rounds') || pathname.endsWith('/leaderboard')
  const showTabs = isSpectatorMode || (Boolean(state) && onTournamentView)

  return (
    <div>
      {showTabs ? (
        <div className="border-b border-zinc-200 bg-zinc-50">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <div
              className="inline-flex gap-0.5 rounded-lg bg-zinc-200/70 p-1"
              role="tablist"
              aria-label="Vue tournoi"
            >
              <NavLink
                to="/tournaments/rounds"
                className={tabClass}
                role="tab"
                aria-current={pathname.endsWith('/rounds') ? 'page' : undefined}
              >
                Rondes
              </NavLink>
              <NavLink
                to="/tournaments/leaderboard"
                className={tabClass}
                role="tab"
                aria-current={
                  pathname.endsWith('/leaderboard') ? 'page' : undefined
                }
              >
                Classement
              </NavLink>
            </div>
            {!isSpectatorMode && state ? (
              <Link
                to="/tournaments"
                className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline"
              >
                Tous les tournois
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
      <Outlet />
    </div>
  )
}
