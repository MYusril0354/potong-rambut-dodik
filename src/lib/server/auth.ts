// Admin auth — HMAC-signed HttpOnly cookie. Secret from env; dev fallback constant.

const DEFAULT_SECRET = 'dev-admin-secret-change-me';
const DEFAULT_PASSWORD = 'dodik';
const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours (seconds)
const COOKIE_NAME = 'admin_session';

export function getSecret(env: any): string {
  return env?.ADMIN_SECRET || DEFAULT_SECRET;
}
export function getPassword(env: any): string {
  return env?.ADMIN_PASSWORD || DEFAULT_PASSWORD;
}

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmac(text: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return b64url(sig);
}

export async function createToken(secret: string): Promise<string> {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_MAX_AGE * 1000 });
  const payloadB64 = b64url(new TextEncoder().encode(payload));
  const sig = await hmac(payloadB64, secret);
  return payloadB64 + '.' + sig;
}

export async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return false;
    const expected = await hmac(payloadB64, secret);
    if (expected !== sig) return false;
    const payload = JSON.parse(b64urlDecode(payloadB64));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export async function isAuthed(request: Request, env: any): Promise<boolean> {
  const cookies = parseCookies(request.headers.get('cookie'));
  const token = cookies[COOKIE_NAME];
  if (!token) return false;
  return verifyToken(token, getSecret(env));
}

export function sessionCookie(token: string, maxAge = SESSION_MAX_AGE): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}
export function clearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}