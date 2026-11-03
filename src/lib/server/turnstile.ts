// Cloudflare Turnstile — verifikasi token di sisi server.
// Jika TURNSTILE_SECRET_KEY tidak di-set (dev), verifikasi dilewati (captcha nonaktif).

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(env: any, token: string): Promise<boolean> {
  const secret = env?.TURNSTILE_SECRET_KEY as string | undefined;
  if (!secret) return true; // not configured → captcha disabled
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