// Web Speech API helpers used by /kiosk/glass for hands-free punching.
// Kept browser-agnostic so the page only deals with strings.

export type PunchType = 'entrada' | 'saída' | 'inicio_almoco' | 'fim_almoco' | 'pausa_cafe' | 'retorno_cafe'

export type VoiceCommand =
  | { kind: 'select'; employeeId: string }
  | { kind: 'punch'; type: PunchType }
  | { kind: 'select-and-punch'; employeeId: string; type: PunchType }
  | { kind: 'cancel' }
  | { kind: 'unknown' }

// Normalise PT/ES text for matching: lowercase + strip accents + collapse spaces.
// Uses the Combining Diacritical Marks block directly so we don't need the /u flag
// (which requires ES2018+; tsconfig has no target set, so it defaults below that).
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

// Each punch type ↔ the trigger phrases users might say (no accents, lowercased).
const PUNCH_TRIGGERS: { type: PunchType; words: string[] }[] = [
  { type: 'entrada',       words: ['entrada', 'entrar', 'bater entrada', 'cheguei'] },
  { type: 'saída',         words: ['saida', 'sair', 'bater saida', 'fui', 'tchau'] },
  { type: 'inicio_almoco', words: ['almoco', 'almocar', 'inicio almoco', 'comecar almoco'] },
  { type: 'fim_almoco',    words: ['voltei almoco', 'fim almoco', 'voltei do almoco'] },
  { type: 'pausa_cafe',    words: ['pausa', 'cafe', 'pausa cafe', 'pausar'] },
  { type: 'retorno_cafe',  words: ['voltei cafe', 'retorno cafe', 'voltei da pausa', 'voltei'] },
]

const CANCEL_WORDS = ['cancelar', 'cancela', 'parar', 'para']

function findPunch(text: string): { type: PunchType; matched: string } | null {
  // Iterate longest-first so "voltei do almoço" beats "voltei".
  const flat = PUNCH_TRIGGERS.flatMap(p => p.words.map(w => ({ type: p.type, w })))
    .sort((a, b) => b.w.length - a.w.length)
  for (const { type, w } of flat) if (text.includes(w)) return { type, matched: w }
  return null
}

function findEmployee(text: string, employees: { id: string; name: string }[]): { id: string; matched: string } | null {
  // Match against the first name (lowercased, no accents). Longest first name first
  // so "joão paulo" beats "joão" when both employees exist.
  const candidates = employees
    .map(e => ({ id: e.id, first: norm(e.name.split(' ')[0]) }))
    .sort((a, b) => b.first.length - a.first.length)
  for (const c of candidates) {
    if (!c.first) continue
    if (text.includes(c.first)) return { id: c.id, matched: c.first }
  }
  return null
}

/** Parse a transcript into a high-level command. */
export function parseVoiceCommand(
  rawTranscript: string,
  employees: { id: string; name: string }[],
): VoiceCommand {
  const text = norm(rawTranscript)
  if (!text) return { kind: 'unknown' }
  if (CANCEL_WORDS.some(w => text.includes(w))) return { kind: 'cancel' }

  const punch = findPunch(text)
  const emp   = findEmployee(text, employees)
  if (emp && punch) return { kind: 'select-and-punch', employeeId: emp.id, type: punch.type }
  if (emp)          return { kind: 'select', employeeId: emp.id }
  if (punch)        return { kind: 'punch', type: punch.type }
  return { kind: 'unknown' }
}

// ── Browser-side wrappers (typed by hand — Web Speech API isn't in lib.dom) ────

interface SpeechRecognitionEventLike { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }
interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void; stop(): void; abort(): void
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechSynthesisAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(text: string, lang = 'pt-PT'): void {
  if (!isSpeechSynthesisAvailable()) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 1.05
    u.pitch = 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch { /* speech-synthesis disabled */ }
}
