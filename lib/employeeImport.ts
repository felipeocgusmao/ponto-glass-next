// Pure validation/normalization for bulk employee import (CSV/XLSX).
// Kept free of Supabase/bcrypt so the column mapping and per-row rules are
// unit-testable; the API route applies these same rules server-side.

export interface ImportedEmployee {
  name: string
  username: string
  email: string | null
  password: string
  role: 'admin' | 'manager' | 'employee'
  workday_hours: number
  lunch_break_minutes: number
  hourly_rate: number | null
}

export type ImportRowResult =
  | { row: number; ok: true; data: ImportedEmployee }
  | { row: number; ok: false; error: string }

// Header aliases accepted in the first row of the spreadsheet, normalized to
// lowercase without accents. Column order is irrelevant; extras are ignored.
const HEADER_ALIASES: Record<string, keyof RawRow> = {
  'nome': 'name', 'name': 'name', 'nome completo': 'name',
  'usuario': 'username', 'username': 'username', 'user': 'username', 'login': 'username',
  'email': 'email', 'e-mail': 'email', 'mail': 'email',
  'senha': 'password', 'password': 'password', 'pwd': 'password',
  'cargo': 'role', 'perfil': 'role', 'role': 'role', 'funcao': 'role',
  'jornada': 'workday', 'horas': 'workday', 'workday_hours': 'workday', 'jornada (h)': 'workday',
  'almoco': 'lunch', 'almoço': 'lunch', 'lunch': 'lunch', 'lunch_break_minutes': 'lunch', 'almoco (min)': 'lunch',
  'valor hora': 'rate', 'valor_hora': 'rate', 'hourly_rate': 'rate', 'rate': 'rate', 'valor/h': 'rate',
}

const ROLE_ALIASES: Record<string, ImportedEmployee['role']> = {
  'admin': 'admin', 'administrador': 'admin', 'administrator': 'admin',
  'manager': 'manager', 'gestor': 'manager', 'gerente': 'manager',
  'employee': 'employee', 'funcionario': 'employee', 'funcionário': 'employee', 'colaborador': 'employee', '': 'employee',
}

interface RawRow {
  name?: unknown; username?: unknown; email?: unknown; password?: unknown
  role?: unknown; workday?: unknown; lunch?: unknown; rate?: unknown
}

function deburr(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Map a spreadsheet row (object keyed by its original headers) to RawRow. */
export function mapHeaders(record: Record<string, unknown>): RawRow {
  const out: RawRow = {}
  for (const [key, value] of Object.entries(record)) {
    const norm = deburr(String(key)).trim().toLowerCase()
    const field = HEADER_ALIASES[norm]
    if (field && out[field] === undefined) out[field] = value
  }
  return out
}

const str = (v: unknown) => (v == null ? '' : String(v)).trim()

/** Validate one mapped row. `rowNumber` is 1-based (as the admin sees it in the file). */
export function validateImportRow(raw: RawRow, rowNumber: number): ImportRowResult {
  const fail = (error: string): ImportRowResult => ({ row: rowNumber, ok: false, error })

  const name = str(raw.name)
  if (name.length < 2 || name.length > 100) return fail('Nome deve ter entre 2 e 100 caracteres')

  const username = str(raw.username).toLowerCase()
  if (username.length < 3 || username.length > 50) return fail('Usuário deve ter entre 3 e 50 caracteres')
  if (!/^[a-z0-9._-]+$/.test(username)) return fail('Usuário só pode conter letras, números, ponto, hífen e underscore')

  const password = str(raw.password)
  if (password.length < 6 || password.length > 100) return fail('Senha deve ter entre 6 e 100 caracteres')

  const email = str(raw.email).toLowerCase() || null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Email inválido')

  const roleKey = deburr(str(raw.role)).toLowerCase()
  const role = ROLE_ALIASES[roleKey]
  if (!role) return fail(`Cargo desconhecido: "${str(raw.role)}" (use admin, gestor ou funcionário)`)

  // Numbers accept both comma and dot decimal separators.
  const num = (v: unknown) => Number(str(v).replace(',', '.'))

  const workday = raw.workday === undefined || str(raw.workday) === '' ? 8 : num(raw.workday)
  if (isNaN(workday) || workday < 1 || workday > 24) return fail('Jornada inválida (1-24h)')

  const lunch = raw.lunch === undefined || str(raw.lunch) === '' ? 60 : num(raw.lunch)
  if (isNaN(lunch) || lunch < 0 || lunch > 120) return fail('Almoço inválido (0-120 min)')

  const rate = raw.rate === undefined || str(raw.rate) === '' ? null : num(raw.rate)
  if (rate !== null && (isNaN(rate) || rate < 0)) return fail('Valor/hora inválido')

  return {
    row: rowNumber, ok: true,
    data: { name, username, email, password, role, workday_hours: workday, lunch_break_minutes: lunch, hourly_rate: rate },
  }
}

export const MAX_IMPORT_ROWS = 50

/**
 * Normalize + validate a parsed spreadsheet. Marks in-batch duplicate
 * usernames as errors (only the first occurrence survives) — DB-level
 * duplicates are the API's job since they're tenant-scoped.
 */
export function normalizeImportRows(records: Record<string, unknown>[]): ImportRowResult[] {
  const seen = new Set<string>()
  return records.map((record, i) => {
    const result = validateImportRow(mapHeaders(record), i + 2) // +2: 1-based + header row
    if (!result.ok) return result
    if (seen.has(result.data.username))
      return { row: result.row, ok: false as const, error: `Usuário "${result.data.username}" duplicado no arquivo` }
    seen.add(result.data.username)
    return result
  })
}
