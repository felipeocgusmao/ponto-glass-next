import nodemailer from 'nodemailer'

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

export async function sendPasswordResetEmail(opts: { to: string; name: string; resetUrl: string }) {
  const transporter = getTransporter()
  if (!transporter) return false

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER
  try {
    await transporter.sendMail({
      from, to: opts.to,
      subject: 'Redefinir senha — PontoGlass',
      html: `<p>Olá <strong>${opts.name}</strong>,</p>
             <p>Recebemos um pedido para redefinir a sua senha no PontoGlass.</p>
             <p><a href="${opts.resetUrl}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Redefinir senha</a></p>
             <p style="color:#6b7280;font-size:13px">O link é válido durante <strong>1 hora</strong>. Se não pediu a redefinição, ignore este email.</p>`,
    })
    return true
  } catch { return false }
}

export async function sendCorrectionEmail(opts: {
  to: string
  employeeName: string
  approved: boolean
  reviewerName: string
  note?: string | null
}) {
  const transporter = getTransporter()
  if (!transporter) return

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER
  const subject = opts.approved ? 'Correcção de ponto aprovada ✓' : 'Correcção de ponto rejeitada'
  const html = opts.approved
    ? `<p>Olá <strong>${opts.employeeName}</strong>,</p>
       <p>A sua correcção de ponto foi <strong style="color:#22c55e">aprovada</strong> por ${opts.reviewerName}.</p>
       <p>Aceda ao <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/ponto">PontoGlass</a> para ver os seus registos atualizados.</p>`
    : `<p>Olá <strong>${opts.employeeName}</strong>,</p>
       <p>A sua correcção de ponto foi <strong style="color:#ef4444">rejeitada</strong>.${opts.note ? `<br>Motivo: ${opts.note}` : ''}</p>
       <p>Aceda ao <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/ponto">PontoGlass</a> para mais informações.</p>`

  try {
    await transporter.sendMail({ from, to: opts.to, subject, html })
  } catch { /* email failure is non-fatal */ }
}
