import { describe, it, expect } from 'vitest'
import { parseVoiceCommand } from '../lib/voice'

const employees = [
  { id: 'e1', name: 'Maria Silva' },
  { id: 'e2', name: 'João Pereira' },
  { id: 'e3', name: 'Ana Costa' },
]

describe('parseVoiceCommand', () => {
  it('parses a bare action (no employee) as a punch on the current selection', () => {
    expect(parseVoiceCommand('entrada', employees)).toEqual({ kind: 'punch', type: 'entrada' })
    expect(parseVoiceCommand('saída', employees)).toEqual({ kind: 'punch', type: 'saída' })
  })

  it('parses a bare first name as a selection', () => {
    expect(parseVoiceCommand('Maria', employees)).toEqual({ kind: 'select', employeeId: 'e1' })
    expect(parseVoiceCommand('joão', employees)).toEqual({ kind: 'select', employeeId: 'e2' })
  })

  it('combines selection and action when both are present', () => {
    expect(parseVoiceCommand('Maria entrada', employees)).toEqual({
      kind: 'select-and-punch', employeeId: 'e1', type: 'entrada',
    })
    expect(parseVoiceCommand('João saída', employees)).toEqual({
      kind: 'select-and-punch', employeeId: 'e2', type: 'saída',
    })
  })

  it('ignores accents and case', () => {
    expect(parseVoiceCommand('MARIA SAÍDA', employees)).toEqual({
      kind: 'select-and-punch', employeeId: 'e1', type: 'saída',
    })
    expect(parseVoiceCommand('joao entrada', employees)).toEqual({
      kind: 'select-and-punch', employeeId: 'e2', type: 'entrada',
    })
  })

  it('recognises break/lunch synonyms', () => {
    expect(parseVoiceCommand('Maria almoço', employees)).toEqual({
      kind: 'select-and-punch', employeeId: 'e1', type: 'inicio_almoco',
    })
    expect(parseVoiceCommand('ana pausa café', employees)).toEqual({
      kind: 'select-and-punch', employeeId: 'e3', type: 'pausa_cafe',
    })
  })

  it('returns cancel for explicit cancel words', () => {
    expect(parseVoiceCommand('cancelar', employees)).toEqual({ kind: 'cancel' })
    expect(parseVoiceCommand('parar tudo', employees)).toEqual({ kind: 'cancel' })
  })

  it('returns unknown when no action or employee matches', () => {
    expect(parseVoiceCommand('', employees)).toEqual({ kind: 'unknown' })
    expect(parseVoiceCommand('blá blá', employees)).toEqual({ kind: 'unknown' })
  })

  it('prefers longer matches when shorter ones overlap', () => {
    // "voltei do almoço" should select fim_almoco, not the bare "voltei" → retorno_cafe.
    expect(parseVoiceCommand('voltei do almoço', employees)).toEqual({
      kind: 'punch', type: 'fim_almoco',
    })
  })
})
