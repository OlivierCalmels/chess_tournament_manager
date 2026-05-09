/**
 * Persistance tournoi sous data/. Ne pas lancer `git clean -fdx` sans vérifier
 * data/tournaments/ et data/public/ — l’historique des tournois y vit.
 *
 * Arborescence par tournoi : data/tournaments/{id}/
 *   - config.json — paramètres figés (roster / meta au démarrage)
 *   - state.json — état courant (dérivé, lecture rapide)
 *   - events.ndjson — journal append-only (chaîne lineHash + stateHash)
 *   - snapshots/ — copies d’état (state-{16}.json) et roster initial
 */
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const DATA_ROOT = path.join(process.cwd(), 'data')
const TOURNAMENTS_DIR = path.join(DATA_ROOT, 'tournaments')
const PUBLIC_DIR = path.join(DATA_ROOT, 'public')
const LIVE_JSON = path.join(PUBLIC_DIR, 'live.json')

const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/

/** Évite d’interpréter les routes réservées comme un id de tournoi. */
const RESERVED_TOURNAMENT_IDS = new Set(['list', 'health', 'init'])

function isTournamentIdParam(id: string): boolean {
  return ID_RE.test(id) && !RESERVED_TOURNAMENT_IDS.has(id)
}

/** Point de départ de la chaîne des événements (pré-image connue). */
const GENESIS_LINE_HASH = '0'.repeat(64)

function ensureDirs() {
  fs.mkdirSync(TOURNAMENTS_DIR, { recursive: true })
  fs.mkdirSync(PUBLIC_DIR, { recursive: true })
}

function tournamentDir(id: string) {
  return path.join(TOURNAMENTS_DIR, id)
}

function sha256hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex')
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

/** Dernier lineHash du journal, ou hash du dernier brut si lignes legacy. */
function readLastEventLineHash(eventsPath: string): string {
  if (!fs.existsSync(eventsPath)) return GENESIS_LINE_HASH
  const content = fs.readFileSync(eventsPath, 'utf8').trim()
  if (!content) return GENESIS_LINE_HASH
  const lines = content.split('\n')
  const lastLine = lines[lines.length - 1]!
  try {
    const o = JSON.parse(lastLine) as { lineHash?: string }
    if (
      typeof o.lineHash === 'string' &&
      /^[0-9a-f]{64}$/i.test(o.lineHash)
    ) {
      return o.lineHash.toLowerCase()
    }
  } catch {
    /* ignore */
  }
  return sha256hex(lastLine)
}

function appendChainedEvent(
  dir: string,
  eventFields: Record<string, unknown>,
  stateSerialized: string,
) {
  const eventsPath = path.join(dir, 'events.ndjson')
  const prevLineHash = readLastEventLineHash(eventsPath)
  const stateHash = sha256hex(stateSerialized)
  const t = new Date().toISOString()
  const recordCore = {
    t,
    prevLineHash,
    stateHash,
    ...eventFields,
  }
  const canonical = JSON.stringify(recordCore)
  const lineHash = sha256hex(`${prevLineHash}\n${canonical}`)
  const line = JSON.stringify({ ...recordCore, lineHash })
  fs.appendFileSync(eventsPath, `${line}\n`, 'utf8')
}

function writeStateSnapshot(dir: string, stateSerialized: string) {
  const stateHash = sha256hex(stateSerialized)
  const snapDir = path.join(dir, 'snapshots')
  fs.mkdirSync(snapDir, { recursive: true })
  const short = stateHash.slice(0, 16)
  fs.writeFileSync(path.join(snapDir, `state-${short}.json`), stateSerialized, 'utf8')
}

/**
 * Charge l’état : state.json si présent, sinon dernier snapshot référencé
 * par stateHash dans events.ndjson (réhydratation).
 */
function loadTournamentStateSerialized(id: string): string | null {
  const dir = tournamentDir(id)
  const statePath = path.join(dir, 'state.json')
  if (fs.existsSync(statePath)) {
    return fs.readFileSync(statePath, 'utf8')
  }
  const eventsPath = path.join(dir, 'events.ndjson')
  if (!fs.existsSync(eventsPath)) return null
  const lines = fs.readFileSync(eventsPath, 'utf8').trim().split('\n').filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const ev = JSON.parse(lines[i]!) as { stateHash?: string }
      if (
        typeof ev.stateHash === 'string' &&
        /^[0-9a-f]{64}$/i.test(ev.stateHash)
      ) {
        const short = ev.stateHash.slice(0, 16).toLowerCase()
        const snap = path.join(dir, 'snapshots', `state-${short}.json`)
        if (fs.existsSync(snap)) {
          return fs.readFileSync(snap, 'utf8')
        }
      }
    } catch {
      /* ignore */
    }
  }
  return null
}

function readTournamentDisplayName(id: string): string {
  const dir = tournamentDir(id)
  for (const file of ['config.json', 'meta.json']) {
    try {
      const p = path.join(dir, file)
      if (!fs.existsSync(p)) continue
      const doc = JSON.parse(fs.readFileSync(p, 'utf8')) as {
        tournamentName?: string
      }
      if (doc.tournamentName && String(doc.tournamentName).trim()) {
        return String(doc.tournamentName).trim()
      }
    } catch {
      /* ignore */
    }
  }
  try {
    const raw = fs.readFileSync(path.join(dir, 'state.json'), 'utf8')
    const doc = JSON.parse(raw) as { tournamentName?: string }
    if (doc.tournamentName && String(doc.tournamentName).trim()) {
      return String(doc.tournamentName).trim()
    }
  } catch {
    /* ignore */
  }
  return id
}

function clearLiveJsonIfTournament(tournamentId: string) {
  try {
    if (!fs.existsSync(LIVE_JSON)) return
    const raw = fs.readFileSync(LIVE_JSON, 'utf8')
    const doc = JSON.parse(raw) as { tournamentId?: string }
    if (doc.tournamentId === tournamentId) {
      fs.writeFileSync(
        LIVE_JSON,
        JSON.stringify({ updatedAt: new Date().toISOString() }, null, 2),
        'utf8',
      )
    }
  } catch {
    /* ignore */
  }
}

function buildArchivePayload(id: string): Record<string, unknown> | null {
  const dir = tournamentDir(id)
  if (!fs.existsSync(dir)) return null
  const configPath = path.join(dir, 'config.json')
  const metaPath = path.join(dir, 'meta.json')
  let config: unknown = null
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    } else if (fs.existsSync(metaPath)) {
      config = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    }
  } catch {
    config = null
  }
  const stateRaw = loadTournamentStateSerialized(id)
  let state: unknown = null
  if (stateRaw) {
    try {
      state = JSON.parse(stateRaw)
    } catch {
      state = stateRaw
    }
  }
  const eventsPath = path.join(dir, 'events.ndjson')
  const eventsNdjson = fs.existsSync(eventsPath)
    ? fs.readFileSync(eventsPath, 'utf8')
    : ''
  const snapDir = path.join(dir, 'snapshots')
  const snapshots: Record<string, unknown> = {}
  if (fs.existsSync(snapDir)) {
    for (const name of fs.readdirSync(snapDir)) {
      if (!name.endsWith('.json')) continue
      try {
        const p = path.join(snapDir, name)
        snapshots[name] = JSON.parse(fs.readFileSync(p, 'utf8'))
      } catch {
        /* ignore */
      }
    }
  }
  return {
    exportFormat: 'chess-tournament-archive-v1',
    exportedAt: new Date().toISOString(),
    tournamentId: id,
    config,
    state,
    eventsNdjson,
    snapshots,
  }
}

function runGitSync(tournamentId: string) {
  if (process.env.ENABLE_TOURNAMENT_GIT_SYNC !== '1') return
  const cwd = process.cwd()
  const relLive = path.join('data', 'public', 'live.json')
  const relTournament = path.join('data', 'tournaments', tournamentId)
  const paths = [relTournament, relLive].filter((p) => {
    const abs = path.join(cwd, p)
    return fs.existsSync(abs)
  })
  if (paths.length === 0) return
  execFileSync('git', ['add', ...paths], { cwd, stdio: 'inherit' })
  try {
    execFileSync('git', ['diff', '--staged', '--quiet'], {
      cwd,
      stdio: 'ignore',
    })
    return
  } catch {
    /* staged changes exist */
  }
  try {
    execFileSync(
      'git',
      ['commit', '-m', `tournament: update ${tournamentId}`],
      { cwd, stdio: 'inherit' },
    )
  } catch {
    return
  }
  execFileSync('git', ['push'], { cwd, stdio: 'inherit' })
}

type PersistBody = {
  state: unknown
  event?: Record<string, unknown>
  triggerGit?: boolean
}

function handlePersist(
  id: string,
  body: PersistBody,
  res: ServerResponse,
): boolean {
  const dir = tournamentDir(id)
  if (!fs.existsSync(dir)) {
    json(res, 404, { error: 'not_found' })
    return true
  }
  const stateSerialized = JSON.stringify(body.state, null, 2)
  fs.writeFileSync(path.join(dir, 'state.json'), stateSerialized, 'utf8')
  appendChainedEvent(
    dir,
    body.event && typeof body.event === 'object' && !Array.isArray(body.event)
      ? { ...body.event }
      : { type: 'STATE_PERSIST' },
    stateSerialized,
  )
  writeStateSnapshot(dir, stateSerialized)

  const persistState =
    body.state &&
    typeof body.state === 'object' &&
    !Array.isArray(body.state)
      ? (body.state as Record<string, unknown>)
      : {}
  fs.writeFileSync(
    LIVE_JSON,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        ...persistState,
      },
      null,
      2,
    ),
    'utf8',
  )

  const gitOnResultOnly =
    body.triggerGit === true && body.event?.type === 'RESULT_SET'
  if (gitOnResultOnly) {
    try {
      runGitSync(id)
    } catch (e) {
      json(res, 500, {
        error: 'git_failed',
        message: String(e),
      })
      return true
    }
  }
  json(res, 200, { ok: true })
  return true
}

export function tournamentServerPlugin(): Plugin {
  return {
    name: 'tournament-server',
    configureServer(server) {
      ensureDirs()

      server.middlewares.use(
        async (req, res, next) => {
          if (!req.url?.startsWith('/api/tournament')) {
            next()
            return
          }

          const url = new URL(req.url, 'http://localhost')
          const pathname = url.pathname

          if (req.method === 'GET' && pathname === '/api/tournament/health') {
            json(res, 200, { ok: true })
            return
          }

          if (req.method === 'GET' && pathname === '/api/tournament/list') {
            ensureDirs()
            const names: string[] = (() => {
              try {
                return fs
                  .readdirSync(TOURNAMENTS_DIR, { withFileTypes: true })
                  .filter((d) => d.isDirectory() && isTournamentIdParam(d.name))
                  .map((d) => d.name)
              } catch {
                return []
              }
            })()
            const tournaments = names.map((id) => {
              const fp = path.join(tournamentDir(id), 'state.json')
              let updatedAt: string | null = null
              try {
                updatedAt = fs.statSync(fp).mtime.toISOString()
              } catch {
                try {
                  const evp = path.join(tournamentDir(id), 'events.ndjson')
                  updatedAt = fs.statSync(evp).mtime.toISOString()
                } catch {
                  /* ignore */
                }
              }
              const name = readTournamentDisplayName(id)
              return { id, name, updatedAt }
            })
            tournaments.sort((a, b) => {
              const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0
              const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0
              return tb - ta
            })
            json(res, 200, { tournaments })
            return
          }

          if (req.method === 'DELETE') {
            const dm = pathname.match(/^\/api\/tournament\/([^/]+)$/)
            if (dm?.[1] && isTournamentIdParam(dm[1])) {
              const id = dm[1]
              const dir = tournamentDir(id)
              if (!fs.existsSync(dir)) {
                json(res, 404, { error: 'not_found' })
                return
              }
              fs.rmSync(dir, { recursive: true, force: true })
              clearLiveJsonIfTournament(id)
              json(res, 200, { ok: true })
              return
            }
          }

          if (req.method === 'GET') {
            const arc = pathname.match(/^\/api\/tournament\/([^/]+)\/archive$/)
            if (arc?.[1] && isTournamentIdParam(arc[1])) {
              const id = arc[1]
              const bundle = buildArchivePayload(id)
              if (!bundle) {
                json(res, 404, { error: 'not_found' })
                return
              }
              json(res, 200, bundle)
              return
            }
          }

          if (req.method === 'GET') {
            const m = pathname.match(/^\/api\/tournament\/([^/]+)\/state$/)
            if (m?.[1] && isTournamentIdParam(m[1])) {
              const id = m[1]
              const raw = loadTournamentStateSerialized(id)
              if (!raw) {
                json(res, 404, { error: 'not_found' })
                return
              }
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(raw)
              return
            }
          }

          if (req.method === 'POST' && pathname === '/api/tournament/init') {
            const raw = await readBody(req)
            let body: {
              tournamentId: string
              meta: unknown
              state: unknown
              rosterSnapshot: unknown
              rosterSha256: string
            }
            try {
              body = JSON.parse(raw)
            } catch {
              json(res, 400, { error: 'invalid_json' })
              return
            }
            if (
              !body.tournamentId ||
              !isTournamentIdParam(body.tournamentId) ||
              typeof body.rosterSha256 !== 'string' ||
              body.rosterSha256.length < 16
            ) {
              json(res, 400, { error: 'bad_request' })
              return
            }
            const dir = tournamentDir(body.tournamentId)
            if (fs.existsSync(dir)) {
              json(res, 409, { error: 'exists' })
              return
            }
            fs.mkdirSync(path.join(dir, 'snapshots'), { recursive: true })
            fs.writeFileSync(
              path.join(dir, 'config.json'),
              JSON.stringify(body.meta, null, 2),
              'utf8',
            )
            fs.writeFileSync(
              path.join(
                dir,
                'snapshots',
                `roster-${body.rosterSha256.slice(0, 16)}.json`,
              ),
              JSON.stringify(body.rosterSnapshot, null, 2),
              'utf8',
            )
            const stateSerialized = JSON.stringify(body.state, null, 2)
            fs.writeFileSync(path.join(dir, 'state.json'), stateSerialized, 'utf8')
            appendChainedEvent(
              dir,
              {
                type: 'TOURNAMENT_STARTED',
                tournamentId: body.tournamentId,
              },
              stateSerialized,
            )
            writeStateSnapshot(dir, stateSerialized)
            const stateObj =
              body.state &&
              typeof body.state === 'object' &&
              !Array.isArray(body.state)
                ? (body.state as Record<string, unknown>)
                : {}
            fs.writeFileSync(
              LIVE_JSON,
              JSON.stringify(
                { updatedAt: new Date().toISOString(), ...stateObj },
                null,
                2,
              ),
              'utf8',
            )
            json(res, 200, { ok: true })
            return
          }

          const persistMatch = pathname.match(
            /^\/api\/tournament\/([^/]+)\/(persist|save)$/,
          )
          if (
            (req.method === 'PUT' || req.method === 'POST') &&
            persistMatch?.[1] &&
            isTournamentIdParam(persistMatch[1])
          ) {
            const id = persistMatch[1]
            const raw = await readBody(req)
            let body: PersistBody
            try {
              body = JSON.parse(raw)
            } catch {
              json(res, 400, { error: 'invalid_json' })
              return
            }
            if (handlePersist(id, body, res)) return
          }

          next()
        },
      )
    },
  }
}
