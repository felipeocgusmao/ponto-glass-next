import nodemailer from 'nodemailer'

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
}

async function sendViaGraph(message: GraphMessage): Promise<boolean> {
  const token = await getGraphToken()
  if (!token) return false
  const sender = encodeURIComponent(process.env.MS_SENDER_EMAIL!)
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${sender}/sendMail`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, saveToSentItems: true }),
      }
    )
    return res.ok || res.status === 202
  } catch { return false }
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
  try {
    await transporter.sendMail({ from, to: opts.to, subject, html })
    return true
  } catch { return false }
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
  try { await transporter.sendMail({ from, to: opts.to, subject, html }) }
  catch { /* email failure is non-fatal */ }
}
