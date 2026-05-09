import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  if (req.headers['x-api-secret'] !== process.env.API_SECRET) {
    res.status(401).end()
    return
  }

  const { message, name, lang } = req.body ?? {}

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message is required' })
    return
  }

  if (message.length > 2000) {
    res.status(400).json({ error: 'message too long' })
    return
  }

  try {
    await resend.emails.send({
      from: 'Matzpen Feedback <onboarding@resend.dev>',
      to: 'uri.mar@gmail.com',
      subject: `[Matzpen Feedback] ${name ? `from ${name}` : 'anonymous'} (${lang ?? 'unknown'})`,
      text: [
        `Message:\n${message.trim()}`,
        `Name: ${name?.trim() || '(anonymous)'}`,
        `Language: ${lang || 'unknown'}`,
      ].join('\n\n'),
    })
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Resend error:', err)
    res.status(500).json({ error: 'send failed' })
  }
}
