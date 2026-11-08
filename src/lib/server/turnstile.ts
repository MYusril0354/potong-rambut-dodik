// Cloudflare Turnstile — verifikasi token di sisi server.
// Default memakai TEST KEY Cloudflare ("always passes") bila TURNSTILE_SECRET_KEY tidak di-set,
// supaya captcha aktif sejak awal tanpa konfigurasi. Untuk produksi WAJIB set
// TURNSTILE_SECRET_KEY dengan secret asli (test key TIDAK memblokir bot sungguhan).

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Cloudflare test secret: "always passes" (cocok untuk dev/demo).
const DEFAULT_SECRET_KEY = '1x0000000000000000000000000000000AA';

export async function verifyTurnstile(env: any, token: string): Promise<boolean> {
  const secret = (env?.TURNSTILE_SECRET_KEY as string | undefined) || DEFAULT_SECRET_KEY;
  if (!token) return false;
  try {
    const form = new FormData();
    form.append('secret', secret);
    form.append('response', token);
    const res = await fetch(SITEVERIFY_URL, { method: 'POST', body: form });
    const data = (await res.json()) as { success?: boolean };
    return data?.success === true;
  } catch {
    return false;
  }
}