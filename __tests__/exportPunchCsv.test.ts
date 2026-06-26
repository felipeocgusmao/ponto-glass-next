import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PunchRecord } from '../lib/types'

// exportPunchCsv creates a Blob, objectURL and triggers a click on an <a> tag.
// In a node environment we need stubs for those browser APIs.

const revokeObjectURL = vi.fn()
const createObjectURL = vi.fn(() => 'blob:mock-url')
vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

// Capture the CSV string that ends up in the Blob constructor.
let capturedCsvContent = ''
vi.stubGlobal('Blob', class MockBlob {
  constructor(parts: (string | BufferSource | Blob)[]) {
    capturedCsvContent = parts.join('')
  }
})

// Capture the anchor element's download attribute and href.
let capturedHref = ''
let capturedDownload = ''
const anchorClick = vi.fn()
const appendChildMock = vi.fn()
const removeChildMock = vi.fn()
const createElementMock = vi.fn(() => ({
  get href() { return capturedHref },
  set href(v: string) { capturedHref = v },
  get download() { return capturedDownload },
  set download(v: string) { capturedDownload = v },
  click: anchorClick,
}))
vi.stubGlobal('document', {
  createElement: createElementMock,
  body: { appendChild: appendChildMock, removeChild: removeChildMock },
})

const { exportPunchCsv } = await import('../lib/utils')

const rec = (type: PunchRecord['type'], timestamp: string): PunchRecord => ({
  id: '1', employee_id: 'e1', employee_name: 'Test', type, timestamp,
  date: timestamp.split('T')[0],
})

describe('exportPunchCsv', () => {
  beforeEach(() => {
    capturedCsvContent = ''
    capturedHref = ''
    capturedDownload = ''
    anchorClick.mockReset()
    appendChildMock.mockReset()
    removeChildMock.mockReset()
  })

  afterEach(() => vi.restoreAllMocks())

  it('includes a CSV header row', () => {
    exportPunchCsv('Ana Silva', 'maio 2026', [rec('entrada', '2026-05-28T08:00:00Z')])
    expect(capturedCsvContent).toContain('Data,Tipo,Hora')
  })

  it('outputs one row per punch record', () => {
    const records = [
      rec('entrada', '2026-05-28T08:00:00Z'),
      rec('saída',   '2026-05-28T17:00:00Z'),
    ]
    exportPunchCsv('Ana Silva', 'maio 2026', records)
    const rows = capturedCsvContent.split('\n').filter(Boolean)
    // BOM + header + 2 data rows = 3 lines (BOM is prepended to first line)
    expect(rows.length).toBe(3)
  })

  it('sorts records by timestamp ascending', () => {
    const records = [
      rec('saída',   '2026-05-28T17:00:00Z'),
      rec('entrada', '2026-05-28T08:00:00Z'),
    ]
    exportPunchCsv('Ana Silva', 'maio 2026', records)
    const dataRows = capturedCsvContent.split('\n').slice(1)
    // CSV uses the PT label, not the raw type
    expect(dataRows[0]).toContain('Entrada')
    expect(dataRows[1]).toContain('Saída')
  })

  it('contains the record date in each data row', () => {
    exportPunchCsv('Ana Silva', 'maio 2026', [rec('entrada', '2026-05-28T08:00:00Z')])
    expect(capturedCsvContent).toContain('2026-05-28')
  })

  it('sets a descriptive filename on the anchor', () => {
    exportPunchCsv('Ana Silva', 'maio 2026', [rec('entrada', '2026-05-28T08:00:00Z')])
    expect(capturedDownload).toContain('Ana_Silva')
    expect(capturedDownload).toContain('maio_2026')
    expect(capturedDownload).toMatch(/\.csv$/)
  })

  it('triggers a click on the anchor element', () => {
    exportPunchCsv('Ana Silva', 'maio 2026', [rec('entrada', '2026-05-28T08:00:00Z')])
    expect(anchorClick).toHaveBeenCalledOnce()
  })

  it('generates a valid object URL', () => {
    exportPunchCsv('Test', 'jan 2026', [])
    expect(createObjectURL).toHaveBeenCalled()
    expect(capturedHref).toBe('blob:mock-url')
  })
})
