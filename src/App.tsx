import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { useTournament } from './context/useTournament'
import { isSpectatorMode } from './config'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { SetupPage } from './pages/SetupPage'
import { TournamentPage } from './pages/TournamentPage'
import { TournamentsLayout } from './pages/TournamentsLayout'
import { TournamentsListPage } from './pages/TournamentsListPage'

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-md px-3 py-2 text-sm font-medium ${
    isActive
      ? 'bg-zinc-900 text-white'
      : 'text-zinc-700 hover:bg-zinc-100'
  }`
}

function AppLayout() {
  const { state } = useTournament()
  return (
    <div className="min-h-dvh">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-zinc-900">
            Tournoi d&apos;échecs
          </p>
          <nav className="flex flex-wrap gap-1">
            {!isSpectatorMode ? (
              <NavLink to="/tournaments" className={navClass}>
                Tournois
              </NavLink>
            ) : (
              <NavLink to="/tournaments/rounds" className={navClass}>
                Tournois
              </NavLink>
            )}
          </nav>
          {state ? (
            <div className="text-right">
              <p className="text-sm font-medium text-zinc-900">
                {state.tournamentName}
              </p>
              {!isSpectatorMode ? (
                <p className="font-mono text-xs text-zinc-500">
                  {state.tournamentId}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>
      <Outlet />
    </div>
  )
}

function IndexRedirect() {
  const { state } = useTournament()
  if (isSpectatorMode) {
    return <Navigate to="/tournaments/leaderboard" replace />
  }
  if (state) {
    return <Navigate to="/tournaments/rounds" replace />
  }
  return <Navigate to="/tournaments" replace />
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<IndexRedirect />} />
        <Route path="tournaments" element={<TournamentsLayout />}>
          <Route index element={<TournamentsListPage />} />
          <Route path="rounds" element={<TournamentPage />} />
          <Route path="rondes" element={<Navigate to="/tournaments/rounds" replace />} />
          <Route path="tournoi" element={<Navigate to="/tournaments/rounds" replace />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="classement" element={<Navigate to="/tournaments/leaderboard" replace />} />
        </Route>
        <Route path="setup" element={<SetupPage />} />
        <Route
          path="tournament"
          element={<Navigate to="/tournaments/rounds" replace />}
        />
        <Route
          path="leaderboard"
          element={<Navigate to="/tournaments/leaderboard" replace />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
