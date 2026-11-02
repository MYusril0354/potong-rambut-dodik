// Shared pure helpers + types (client & server safe).

export const CONFIG = {
  totalNumbers: 40,
  slotMinutes: 15,
  startHour: 6,
  startMinute: 30,
  demoAdminPassword: 'dodik',
};

export type BookingStatus = 'booked' | 'serving' | 'done' | 'skipped' | 'cancelled';

export interface Booking {
  id: string;
  date: string;
  number: number;
  slot_time: string;
  customer_name: string;
  customer_phone: string;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
  wa_last_notified_at?: string;
}

export interface QueueState {
  date: string;
  currently_serving: number;
  updated_at: number;
}

export interface QueueInfo {
  date: string;
  currently_serving: number;
  is_closed: boolean;
  total_numbers: number;
  booked: number[];
  serving: number | null;
  done: number[];
  skipped: number[];
  remaining: number;
}

export interface BookResult {
  ok: boolean;
  error?: string;
  booking?: Booking;
}

export interface MyBooking {
  number: number;
  phone: string;
  date: string;
}

export const PILL: Record<string, string> = {
  booked: 'pill booked',
  serving: 'pill serving',
  done: 'pill done',
  skipped: 'pill skipped',
  cancelled: 'pill cancelled',
};

// ---------- timezone (WIB) ----------
export function todayWIB(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}
export function currentDayWIB(): number {
  return new Date(todayWIB() + 'T00:00:00').getDay(); // 0=Sun .. 6=Sat (Fri=5)
}
export function isClosedDay(): boolean {
  const d = currentDayWIB();
  return d === 5 || d === 0;
}
export function slotTime(n: number): string {
  const total = CONFIG.startHour * 60 + CONFIG.startMinute + (n - 1) * CONFIG.slotMinutes;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export function formatMinutes(min: number): string {
  if (min <= 0) return 'sekarang';
  if (min < 60) return '±' + min + ' menit lagi';
  return '±' + Math.round((min / 60) * 10) / 10 + ' jam lagi';
}
export function firstName(name: string): string {
  return String(name).trim().split(/\s+/)[0] || String(name);
}

// ---------- WhatsApp ----------
export function toWaPhone(phone: string): string | null {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return null;
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  return '62' + digits;
}
export function buildWaUrl(phone: string, message: string): string | null {
  const wa = toWaPhone(phone);
  if (!wa) return null;
  return 'https://wa.me/' + wa + '?text=' + encodeURIComponent(message);
}
export function waTemplate(booking: Booking, state: QueueInfo, status: BookingStatus): string {
  const nama = firstName(booking.customer_name);
  const n = booking.number;
  switch (status) {
    case 'booked': {
      const diff = n - state.currently_serving;
      if (state.currently_serving > 0 && diff <= 2 && diff > 0) {
        return `Halo ${nama}, nomor antrian #${n} Anda akan segera dipanggil di Pangkas Rambut Dodik. Mohon bersiap datang. Terima kasih! ✂️`;
      }
      return `Halo ${nama}, booking Anda di Pangkas Rambut Dodik tercatat untuk nomor antrian #${n} (perkiraan jam ${booking.slot_time}). Kami akan kabari lagi saat giliran Anda mendekat. Terima kasih! ✂️`;
    }
    case 'serving':
      return `Halo ${nama}, giliran Anda sudah tiba di Pangkas Rambut Dodik (nomor #${n}). Silakan langsung ke kursi barber. Terima kasih! ✂️`;
    case 'done':
      return `Halo ${nama}, terima kasih sudah datang ke Pangkas Rambut Dodik. Semoga puas dengan hasilnya. Sampai jumpa lagi! ✂️`;
    case 'skipped':
      return `Halo ${nama}, nomor antrian #${n} Anda terlewat karena tidak hadir saat dipanggil. Silakan hubungi kami untuk penjadwalan ulang. Terima kasih.`;
    default:
      return '';
  }
}

// ---------- derived status ----------
export function effectiveStatus(b: Booking, state: QueueInfo): BookingStatus {
  if (b.status === 'cancelled') return 'cancelled';
  if (b.status === 'skipped') return 'skipped';
  if (b.status === 'done') return 'done';
  if (b.number === state.currently_serving) return 'serving';
  if (state.currently_serving > 0 && b.number < state.currently_serving) return 'done';
  return 'booked';
}