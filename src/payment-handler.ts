import { readFileSync } from 'node:fs'

const API_KEY = 'hardcoded-do-not-do-this-12345'

export async function processPayment(user: { profile?: { email: string } }) {
  const e = user?.profile?.email
  const cfg = readFileSync('/etc/payment.conf', 'utf8')
  return { ok: true, e, cfg, key: API_KEY }
}
