'use client'

import { useRef, useState } from 'react'
import { normalizeImportRows, MAX_IMPORT_ROWS, type ImportRowResult } from '@/lib/employeeImport'

type Phase = 'pick' | 'preview' | 'importing' | 'done'

const MODEL_CSV =
  'nome;usuario;email;senha;cargo;jornada;almoco;valor_hora\n' +
  'Maria Silva;maria.silva;maria@empresa.com;senha123;funcionario;8;60;12,50\n' +
  'João Costa;joao.costa;;senha456;gestor;8;60;\n'

export function ImportEmployeesCard({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ImportRowResult[]>([])
  const [err, setErr] = useState('')
  const [progress, setProgress] = useState(0)
  const [summary, setSummary] = useState<{ created: number; errors: { row: number; error: string }[] }>({ created: 0, errors: [] })

  const downloadModel = () => {
    const blob = new Blob(['﻿' + MODEL_CSV], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'funcionarios_modelo.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleFile = async (file: File) => {
    setErr(''); setFileName(file.name)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer())
      const ws = wb.Sheets[wb.SheetNames[0]]
      // defval: '' keeps empty cells as keys so optional columns survive.
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      if (!records.length) { setErr('Arquivo vazio ou sem linhas de dados abaixo do cabeçalho.'); return }
      setRows(normalizeImportRows(records))
      setPhase('preview')
    } catch {
      setErr('Não foi possível ler o arquivo. Use CSV ou XLSX com cabeçalho na primeira linha.')
    }
  }

  const valid = rows.filter(r => r.ok)
  const invalid = rows.filter(r => !r.ok)

  const handleImport = async () => {
    setPhase('importing'); setErr(''); setProgress(0)
    let created = 0
    const errors: { row: number; error: string }[] = invalid.map(r => ({ row: r.row, error: (r as { error: string }).error }))

    // The API re-validates everything; we send the original-shaped objects in
    // chunks that fit the server cap.
    const payloadRows = valid.map(r => ({
      nome: r.data.name, usuario: r.data.username, email: r.data.email ?? '',
      senha: r.data.password, cargo: r.data.role,
      jornada: r.data.workday_hours, almoco: r.data.lunch_break_minutes,
      valor_hora: r.data.hourly_rate ?? '',
    }))
    for (let i = 0; i < payloadRows.length; i += MAX_IMPORT_ROWS) {
      const chunk = payloadRows.slice(i, i + MAX_IMPORT_ROWS)
      try {
        const res = await fetch('/api/employees/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk }),
        })
        const data = await res.json()
        if (res.status === 401 || res.status === 403) { setErr(data.error ?? 'Sem permissão'); break }
        created += data.created ?? 0
        // Server row numbers restart per chunk; remap to the file's numbering.
        for (const e of data.errors ?? []) {
          const localIndex = e.row - 2
          const fileRow = valid[i + localIndex]?.row ?? e.row
          errors.push({ row: fileRow, error: e.error })
        }
      } catch {
        errors.push({ row: -1, error: 'Falha de rede no envio de um dos lotes — confira quem foi criado antes de repetir.' })
        break
      }
      setProgress(Math.min(i + MAX_IMPORT_ROWS, payloadRows.length))
    }

    errors.sort((a, b) => a.row - b.row)
    setSummary({ created, errors })
    setPhase('done')
    if (created > 0) onDone()
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <div className="card-title">Importar funcionários (CSV / Excel)</div>
        <button className="btn ghost sm" onClick={onClose}>✕ Fechar</button>
      </div>
      <div className="card-body">
        {phase === 'pick' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
              Primeira linha = cabeçalho. Colunas reconhecidas: <code>nome</code>, <code>usuario</code>, <code>senha</code> (obrigatórias),{' '}
              <code>email</code>, <code>cargo</code> (admin/gestor/funcionário), <code>jornada</code>, <code>almoco</code>, <code>valor_hora</code>.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
              <button className="btn primary" onClick={() => fileRef.current?.click()}>Escolher arquivo…</button>
              <button className="btn ghost" onClick={downloadModel}>Baixar modelo CSV</button>
            </div>
            {err && <div className="alert-inline err">{err}</div>}
          </div>
        )}

        {phase === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12 }}>
              <strong>{fileName}</strong> — {valid.length} linha(s) válida(s), {invalid.length} com erro.
            </div>
            {invalid.length > 0 && (
              <div className="alert-inline err" style={{ maxHeight: 140, overflowY: 'auto', display: 'block' }}>
                {invalid.map(r => (
                  <div key={r.row} style={{ fontSize: 11 }}>Linha {r.row}: {(r as { error: string }).error}</div>
                ))}
              </div>
            )}
            {valid.length > 0 && (
              <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto' }}>
                <table className="table" style={{ fontSize: 12 }}>
                  <thead><tr><th>Linha</th><th>Nome</th><th>Usuário</th><th>Email</th><th>Cargo</th><th className="right">Jornada</th></tr></thead>
                  <tbody>
                    {valid.map(r => (
                      <tr key={r.row}>
                        <td className="tnum muted">{r.row}</td>
                        <td>{r.data.name}</td>
                        <td className="mono">{r.data.username}</td>
                        <td className="muted">{r.data.email ?? '—'}</td>
                        <td>{r.data.role}</td>
                        <td className="right tnum">{r.data.workday_hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" disabled={valid.length === 0} onClick={handleImport}>
                Importar {valid.length} funcionário(s)
              </button>
              <button className="btn ghost" onClick={() => { setPhase('pick'); setRows([]) }}>Outro arquivo</button>
            </div>
          </div>
        )}

        {phase === 'importing' && (
          <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
            A importar… {progress}/{valid.length}
          </div>
        )}

        {phase === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className={`alert-inline ${summary.created > 0 ? 'ok' : 'err'}`}>
              {summary.created} funcionário(s) criado(s){summary.errors.length ? ` · ${summary.errors.length} falha(s)` : ''}
            </div>
            {summary.errors.length > 0 && (
              <div style={{ maxHeight: 140, overflowY: 'auto', fontSize: 11, color: 'var(--danger-fg, #f66)' }}>
                {summary.errors.map((e, i) => (
                  <div key={i}>{e.row > 0 ? `Linha ${e.row}: ` : ''}{e.error}</div>
                ))}
              </div>
            )}
            {err && <div className="alert-inline err">{err}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" onClick={() => { setPhase('pick'); setRows([]); setSummary({ created: 0, errors: [] }) }}>
                Importar outro arquivo
              </button>
              <button className="btn ghost" onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
