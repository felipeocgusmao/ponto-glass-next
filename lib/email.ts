import nodemailer from 'nodemailer'
import { fmtCentesimal, fmtCentesimalSigned } from './utils'

// ── Retry helper ────────────────────────────────────────────────────────────────
// Retries an async operation up to `attempts` times with exponential backoff.
// Keeps email failures non-fatal while giving transient network errors a chance
// to recover. Final failure is logged and returned as `false`.
async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 1000,
): Promise<T | false> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, delayMs * 2 ** i))
      } else {
        console.error('[email] send failed after', attempts, 'attempts:', err)
      }
    }
  }
  return false
}

// ── Microsoft Graph API (preferred) ────────────────────────────────────────────
// Uses Client Credentials flow: no user interaction, token cached per invocation.
// Requires MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER_EMAIL.

function hasGraphConfig() {
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER_EMAIL } = process.env
  return !!(MS_TENANT_ID && MS_CLIENT_ID && MS_CLIENT_SECRET && MS_SENDER_EMAIL)
}

async function getGraphToken(): Promise<string | null> {
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: MS_CLIENT_ID!,
          client_secret: MS_CLIENT_SECRET!,
          scope: 'https://graph.microsoft.com/.default',
        }),
      }
    )
    if (!res.ok) return null
    const data = await res.json() as { access_token?: string }
    return data.access_token ?? null
  } catch { return null }
}

interface GraphMessage {
  subject: string
  body: { contentType: 'HTML' | 'Text'; content: string }
  toRecipients: { emailAddress: { address: string; name?: string } }[]
  attachments?: {
    '@odata.type': '#microsoft.graph.fileAttachment'
    name: string
    contentType: string
    contentBytes: string // base64
  }[]
}

// Plain-text attachment (e.g. the monthly CSV archive, #249) in a transport-
// neutral shape; converted to Graph fileAttachment or nodemailer format below.
export interface EmailAttachment {
  filename: string
  content: string
  contentType?: string
}

function toGraphAttachments(atts?: EmailAttachment[]): GraphMessage['attachments'] {
  if (!atts?.length) return undefined
  return atts.map(a => ({
    '@odata.type': '#microsoft.graph.fileAttachment' as const,
    name: a.filename,
    contentType: a.contentType ?? 'text/csv',
    contentBytes: Buffer.from(a.content, 'utf8').toString('base64'),
  }))
}

async function sendViaGraph(message: GraphMessage): Promise<boolean> {
  const token = await getGraphToken()
  if (!token) return false
  const sender = encodeURIComponent(process.env.MS_SENDER_EMAIL!)
  const result = await withRetry(async () => {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${sender}/sendMail`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, saveToSentItems: true }),
      }
    )
    if (!res.ok && res.status !== 202) throw new Error(`Graph API ${res.status}`)
    return true
  })
  return result !== false
}

// ── SMTP fallback ───────────────────────────────────────────────────────────────
function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
}

// ── Public API (interface unchanged) ───────────────────────────────────────────

export async function sendPasswordResetEmail(opts: {
  to: string
  name: string
  resetUrl: string
}): Promise<boolean> {
  const subject = 'Redefinir senha — PontoGlass'
  const html = `<p>Olá <strong>${opts.name}</strong>,</p>
    <p>Recebemos um pedido para redefinir a sua senha no PontoGlass.</p>
    <p><a href="${opts.resetUrl}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Redefinir senha</a></p>
    <p style="color:#6b7280;font-size:13px">O link é válido durante <strong>1 hora</strong>. Se não pediu a redefinição, ignore este email.</p>`

  if (hasGraphConfig()) {
    return sendViaGraph({
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: opts.to, name: opts.name } }],
    })
  }

  const transporter = getTransporter()
  if (!transporter) return false
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER
  const result = await withRetry(() => transporter.sendMail({ from, to: opts.to, subject, html }))
  return result !== false
}

export async function sendMonthlyReportEmployeeEmail(opts: {
  to: string
  name: string
  period: string
  workedMin: number
  overtimeMin: number
  earnings: number | null
  days: number
  incompleteDays: number
  appUrl: string
  dailyRows?: { date: string; netMin: number; incomplete: boolean }[]
}): Promise<boolean> {
  const subject = `Relatório de ponto — ${opts.period}`
  // Relatórios usam horas centesimais (base 100): 45min → "0,75", 7h30 → "7,50".
  // Os totais já chegam arredondados ao quarto de hora (lib/utils.calcWorkedMinutesPeriod).
  const fmtH = fmtCentesimal
  const overtimeColor = opts.overtimeMin >= 0 ? '#22c55e' : '#ef4444'
  const overtimeLabel = fmtCentesimalSigned(opts.overtimeMin)
  const incompleteRow = opts.incompleteDays > 0
    ? `<tr><td style="padding:10px 16px;color:#6b7280;border-bottom:1px solid #e5e7eb">Dias incompletos</td><td style="padding:10px 16px;text-align:right;font-weight:600;color:#ef4444;border-bottom:1px solid #e5e7eb">⚠ ${opts.incompleteDays}</td></tr>`
    : ''
  const earningsRow = opts.earnings != null
    ? `<tr><td style="padding:10px 16px;color:#6b7280">Ganhos estimados</td><td style="padding:10px 16px;text-align:right;font-weight:600">${opts.earnings.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</td></tr>`
    : ''

  // Day-by-day breakdown table (optional payslip detail)
  const dailySection = opts.dailyRows && opts.dailyRows.length > 0
    ? `<div style="margin-top:24px">
        <div style="font-size:12px;font-weight:600;color:#374151;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">Detalhe por dia</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:12px">
          <thead><tr style="background:#f3f4f6">
            <th style="padding:7px 12px;text-align:left;color:#6b7280;font-weight:600">Data</th>
            <th style="padding:7px 12px;text-align:right;color:#6b7280;font-weight:600">Horas</th>
          </tr></thead>
          <tbody>${opts.dailyRows.map((r, i) => {
            const [y, m, d] = r.date.split('-').map(Number)
            const label = new Date(y, m - 1, d).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' })
            const hVal = r.incomplete ? '<span style="color:#ef4444">Incompleto</span>' : fmtH(r.netMin)
            const bg = i % 2 === 0 ? '#fff' : '#f9fafb'
            return `<tr style="background:${bg}"><td style="padding:6px 12px;border-top:1px solid #e5e7eb;text-transform:capitalize">${label}</td><td style="padding:6px 12px;border-top:1px solid #e5e7eb;text-align:right;font-weight:500">${hVal}</td></tr>`
          }).join('')}</tbody>
        </table>
      </div>`
    : ''

  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
<div style="max-width:540px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#6366f1;padding:28px 32px 24px">
    <div style="color:#fff;font-size:20px;font-weight:700">PontoGlass</div>
    <div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:4px">Relatório mensal de ponto</div>
  </div>
  <div style="padding:28px 32px">
    <p style="margin:0 0 20px;font-size:15px;color:#111827">Olá <strong>${opts.name}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#374151">Segue o resumo do seu ponto referente a <strong>${opts.period}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <tr><td style="padding:10px 16px;color:#6b7280;border-bottom:1px solid #e5e7eb">Dias trabalhados</td><td style="padding:10px 16px;text-align:right;font-weight:600;border-bottom:1px solid #e5e7eb">${opts.days}</td></tr>
      <tr><td style="padding:10px 16px;color:#6b7280;border-bottom:1px solid #e5e7eb">Total de horas</td><td style="padding:10px 16px;text-align:right;font-weight:600;border-bottom:1px solid #e5e7eb">${fmtH(opts.workedMin)}</td></tr>
      <tr><td style="padding:10px 16px;color:#6b7280;border-bottom:1px solid #e5e7eb">Horas extras</td><td style="padding:10px 16px;text-align:right;font-weight:700;color:${overtimeColor};border-bottom:1px solid #e5e7eb">${overtimeLabel}</td></tr>
      ${incompleteRow}${earningsRow}
    </table>
    ${opts.incompleteDays > 0 ? `<p style="margin:16px 0 0;font-size:12px;color:#ef4444">⚠ Tem ${opts.incompleteDays} dia(s) sem saída registada. Submeta uma correcção para regularizar.</p>` : ''}
    ${dailySection}
    <div style="margin-top:24px">
      <a href="${opts.appUrl}/ponto" style="display:inline-block;padding:10px 22px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">Ver os meus registos</a>
    </div>
  </div>
  <div style="padding:16px 32px;background:#f9fafb;font-size:11px;color:#9ca3af">Este e-mail foi enviado automaticamente pelo PontoGlass. Não responda a este endereço.</div>
</div></body></html>`

  if (hasGraphConfig()) {
    return sendViaGraph({ subject, body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: opts.to, name: opts.name } }] })
  }
  const transporter = getTransporter()
  if (!transporter) return false
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER
  const result = await withRetry(() => transporter.sendMail({ from, to: opts.to, subject, html }))
  return result !== false
}

export async function sendMonthlyReportAdminEmail(opts: {
  to: string
  adminName: string
  period: string
  rows: { name: string; workedMin: number; overtimeMin: number; earnings: number | null; days: number; incompleteDays: number }[]
  totalWorkedMin: number
  totalEarnings: number
  appUrl: string
  /** Raw month archive (#249) — attached so the admin's inbox doubles as legal retention. */
  attachments?: EmailAttachment[]
}): Promise<boolean> {
  const subject = `Relatório consolidado — ${opts.period}`
  // Relatórios consolidados usam horas centesimais (base 100): 7h45 → "7,75".
  const fmtH = fmtCentesimal
  const tableRows = opts.rows.map(r => {
    const otColor = r.overtimeMin >= 0 ? '#22c55e' : '#ef4444'
    const otLabel = fmtCentesimalSigned(r.overtimeMin)
    const earnCell = r.earnings != null ? r.earnings.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) : '—'
    const incCell = r.incompleteDays > 0 ? `<span style="color:#ef4444">⚠ ${r.incompleteDays}</span>` : '—'
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${r.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${r.days}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${fmtH(r.workedMin)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:${otColor};font-weight:600">${otLabel}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${earnCell}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${incCell}</td>
    </tr>`
  }).join('')
  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
<div style="max-width:680px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
  <div style="background:#6366f1;padding:28px 32px 24px">
    <div style="color:#fff;font-size:20px;font-weight:700">PontoGlass</div>
    <div style="color:rgba(255,255,255,.8);font-size:13px;margin-top:4px">Relatório consolidado — ${opts.period}</div>
  </div>
  <div style="padding:28px 32px">
    <p style="margin:0 0 20px;font-size:15px;color:#111827">Olá <strong>${opts.adminName}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#374151">Resumo de ponto de todos os funcionários em <strong>${opts.period}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f3f4f6">
          <th style="padding:10px 12px;text-align:left;font-weight:600;color:#374151">Funcionário</th>
          <th style="padding:10px 12px;text-align:center;font-weight:600;color:#374151">Dias</th>
          <th style="padding:10px 12px;text-align:right;font-weight:600;color:#374151">Horas</th>
          <th style="padding:10px 12px;text-align:right;font-weight:600;color:#374151">Extras</th>
          <th style="padding:10px 12px;text-align:right;font-weight:600;color:#374151">Ganhos</th>
          <th style="padding:10px 12px;text-align:center;font-weight:600;color:#374151">Incompletos</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
      <tfoot>
        <tr style="background:#f9fafb;font-weight:700">
          <td style="padding:10px 12px">Total</td>
          <td style="padding:10px 12px"></td>
          <td style="padding:10px 12px;text-align:right">${fmtH(opts.totalWorkedMin)}</td>
          <td style="padding:10px 12px"></td>
          <td style="padding:10px 12px;text-align:right">${opts.totalEarnings > 0 ? opts.totalEarnings.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) : '—'}</td>
          <td style="padding:10px 12px"></td>
        </tr>
      </tfoot>
    </table>
    <div style="margin-top:24px">
      <a href="${opts.appUrl}/admin" style="display:inline-block;padding:10px 22px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">Ver painel de administração</a>
    </div>
  </div>
  <div style="padding:16px 32px;background:#f9fafb;font-size:11px;color:#9ca3af">Este e-mail foi enviado automaticamente pelo PontoGlass. Não responda a este endereço.</div>
</div></body></html>`

  if (hasGraphConfig()) {
    return sendViaGraph({
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: opts.to, name: opts.adminName } }],
      attachments: toGraphAttachments(opts.attachments),
    })
  }
  const transporter = getTransporter()
  if (!transporter) return false
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER
  const result = await withRetry(() => transporter.sendMail({
    from, to: opts.to, subject, html,
    attachments: opts.attachments?.map(a => ({
      filename: a.filename, content: a.content, contentType: a.contentType ?? 'text/csv',
    })),
  }))
  return result !== false
}

export async function sendCorrectionEmail(opts: {
  to: string
  employeeName: string
  approved: boolean
  reviewerName: string
  note?: string | null
}): Promise<void> {
  const subject = opts.approved ? 'Correcção de ponto aprovada ✓' : 'Correcção de ponto rejeitada'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const html = opts.approved
    ? `<p>Olá <strong>${opts.employeeName}</strong>,</p>
       <p>A sua correcção de ponto foi <strong style="color:#22c55e">aprovada</strong> por ${opts.reviewerName}.</p>
       <p>Aceda ao <a href="${appUrl}/ponto">PontoGlass</a> para ver os seus registos atualizados.</p>`
    : `<p>Olá <strong>${opts.employeeName}</strong>,</p>
       <p>A sua correcção de ponto foi <strong style="color:#ef4444">rejeitada</strong>.${opts.note ? `<br>Motivo: ${opts.note}` : ''}</p>
       <p>Aceda ao <a href="${appUrl}/ponto">PontoGlass</a> para mais informações.</p>`

  if (hasGraphConfig()) {
    await sendViaGraph({
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: opts.to, name: opts.employeeName } }],
    })
    return
  }

  const transporter = getTransporter()
  if (!transporter) return
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER
  await withRetry(() => transporter.sendMail({ from, to: opts.to, subject, html }))
}

// Daily pending-requests digest for admins (#252) — the safety net for admins
// without web push installed. Only ever called when there ARE pending items.
export async function sendPendingRequestsEmail(opts: {
  to: string
  adminName: string
  corrections: number
  compensations: number
}): Promise<boolean> {
  const total = opts.corrections + opts.compensations
  const subject = `${total} pedido(s) pendente(s) — PontoGlass`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const parts: string[] = []
  if (opts.corrections > 0) parts.push(`<strong>${opts.corrections}</strong> correção(ões) de ponto`)
  if (opts.compensations > 0) parts.push(`<strong>${opts.compensations}</strong> compensação(ões) de horas`)
  const html = `<p>Olá <strong>${opts.adminName}</strong>,</p>
    <p>Há pedidos de funcionários aguardando a sua revisão: ${parts.join(' e ')}.</p>
    <p><a href="${appUrl}/admin" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Rever pedidos</a></p>
    <p style="color:#6b7280;font-size:13px">Este resumo é enviado nos dias úteis enquanto houver pedidos por resolver.</p>`

  if (hasGraphConfig()) {
    return sendViaGraph({
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: opts.to, name: opts.adminName } }],
    })
  }
  const transporter = getTransporter()
  if (!transporter) return false
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER
  const result = await withRetry(() => transporter.sendMail({ from, to: opts.to, subject, html }))
  return result !== false
}

export async function sendEmailVerification(opts: {
  to: string
  name: string
  confirmUrl: string
}): Promise<boolean> {
  const subject = 'Confirme o seu novo e-mail — PontoGlass'
  const html = `<p>Olá <strong>${opts.name}</strong>,</p>
    <p>Recebemos um pedido para alterar o seu e-mail no PontoGlass.</p>
    <p><a href="${opts.confirmUrl}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Confirmar novo e-mail</a></p>
    <p style="color:#6b7280;font-size:13px">O link é válido durante <strong>24 horas</strong>. Se não pediu esta alteração, ignore este e-mail — o seu e-mail atual permanece inalterado.</p>`

  if (hasGraphConfig()) {
    return sendViaGraph({
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: opts.to, name: opts.name } }],
    })
  }

  const transporter = getTransporter()
  if (!transporter) return false
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER
  const result = await withRetry(() => transporter.sendMail({ from, to: opts.to, subject, html }))
  return result !== false
}
