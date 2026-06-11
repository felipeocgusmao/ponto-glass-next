import { describe, it, expect } from 'vitest'
import { mapHeaders, validateImportRow, normalizeImportRows } from '../lib/employeeImport'

const base = { nome: 'Maria Silva', usuario: 'maria.silva', senha: 'senha123' }

describe('mapHeaders', () => {
  it('accepts pt and en header aliases, case/accents-insensitive', () => {
    const mapped = mapHeaders({
      'Nome': 'Ana', 'USUARIO': 'ana', 'Senha': 'x'.repeat(6),
      'E-mail': 'a@b.co', 'Cargo': 'gestor', 'Jornada': '8', 'Almoço': '60', 'Valor_Hora': '10,5',
    })
    expect(mapped).toMatchObject({ name: 'Ana', username: 'ana', email: 'a@b.co', role: 'gestor', workday: '8', lunch: '60', rate: '10,5' })
  })

  it('ignores unknown columns', () => {
    expect(mapHeaders({ nome: 'Ana', telefone: '999' })).toEqual({ name: 'Ana' })
  })
})

describe('validateImportRow', () => {
  const row = (overrides: Record<string, unknown> = {}) =>
    validateImportRow(mapHeaders({ ...base, ...overrides }), 2)

  it('accepts a minimal valid row with defaults', () => {
    const r = row()
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data).toMatchObject({
        name: 'Maria Silva', username: 'maria.silva', email: null,
        role: 'employee', workday_hours: 8, lunch_break_minutes: 60, hourly_rate: null,
      })
    }
  })

  it('maps role aliases (gestor → manager, funcionário → employee)', () => {
    const g = row({ cargo: 'Gestor' })
    const f = row({ cargo: 'Funcionário' })
    expect(g.ok && g.data.role).toBe('manager')
    expect(f.ok && f.data.role).toBe('employee')
  })

  it('accepts comma decimals for rate and workday', () => {
    const r = row({ valor_hora: '12,50', jornada: '7,5' })
    expect(r.ok && r.data.hourly_rate).toBe(12.5)
    expect(r.ok && r.data.workday_hours).toBe(7.5)
  })

  it('rejects bad usernames, short passwords, invalid emails and unknown roles', () => {
    expect(row({ usuario: 'ab' }).ok).toBe(false)
    expect(row({ usuario: 'maria silva' }).ok).toBe(false)
    expect(row({ senha: '12345' }).ok).toBe(false)
    expect(row({ email: 'not-an-email' }).ok).toBe(false)
    expect(row({ cargo: 'chefe' }).ok).toBe(false)
  })

  it('lowercases username and email', () => {
    const r = row({ usuario: 'Maria.SILVA', email: 'Maria@Empresa.COM' })
    expect(r.ok && r.data.username).toBe('maria.silva')
    expect(r.ok && r.data.email).toBe('maria@empresa.com')
  })
})

describe('normalizeImportRows', () => {
  it('numbers rows from 2 (header is row 1) and flags in-batch duplicates', () => {
    const results = normalizeImportRows([
      base,
      { ...base, usuario: 'outra.pessoa' },
      { ...base }, // duplicate of row 2's username
    ])
    expect(results[0]).toMatchObject({ row: 2, ok: true })
    expect(results[1]).toMatchObject({ row: 3, ok: true })
    expect(results[2].ok).toBe(false)
    expect(results[2]).toMatchObject({ row: 4 })
    if (!results[2].ok) expect(results[2].error).toMatch(/duplicado/)
  })
})
