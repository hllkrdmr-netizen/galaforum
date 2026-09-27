import type { CreateMeetupInput, MeetupForm } from '../types/community';

export type MeetupErrors = Partial<Record<keyof MeetupForm, string>>;

const MAX_DAYS_AHEAD = 180;

/** Parses "GG.AA.YYYY" + "SS:DD" in the device time zone. Returns null for impossible dates. */
export function parseDateTime(date: string, time: string): Date | null {
  const d = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(date.trim());
  const t = /^(\d{1,2})[:.](\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const [day, month, year] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hh, mm] = [Number(t[1]), Number(t[2])];
  if (hh > 23 || mm > 59) return null;
  const out = new Date(year, month - 1, day, hh, mm, 0, 0);
  if (out.getFullYear() !== year || out.getMonth() !== month - 1 || out.getDate() !== day) return null;
  return out;
}

/**
 * Accepts "41.0082, 28.9784", "41.0082 28.9784" or map links containing "@lat,lng", "q=lat,lng",
 * "ll=lat,lng" or "query=lat,lng". Returns null when nothing usable is found.
 */
export function parseCoords(text: string): { lat: number; lng: number } | null {
  const s = decodeURIComponent(text.trim());
  if (!s) return null;
  const patterns = [
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /[?&](?:q|ll|query|daddr|destination)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/,
  ];
  for (const p of patterns) {
    const m = p.exec(s);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

export function validateMeetup(form: MeetupForm, now: number = Date.now()): { errors: MeetupErrors; input: CreateMeetupInput | null } {
  const errors: MeetupErrors = {};
  const title = form.title.trim();
  if (title.length < 5 || title.length > 100) errors.title = 'Başlık 5–100 karakter olmalı.';
  if (form.description.trim().length > 2000) errors.description = 'Açıklama en fazla 2000 karakter olabilir.';
  const when = parseDateTime(form.date, form.time);
  if (!when) {
    errors.date = 'Tarihi GG.AA.YYYY, saati SS:DD biçiminde yaz.';
  } else if (when.getTime() < now + 10 * 60_000) {
    errors.date = 'Buluşma en az 10 dakika sonrası için olmalı.';
  } else if (when.getTime() > now + MAX_DAYS_AHEAD * 86_400_000) {
    errors.date = `Buluşma en fazla ${MAX_DAYS_AHEAD} gün sonrası için açılabilir.`;
  }
  const city = form.city.trim();
  if (city.length < 2 || city.length > 60) errors.city = 'Şehir 2–60 karakter olmalı.';
  const place = form.placeName.trim();
  if (place.length < 2 || place.length > 100) errors.placeName = 'Buluşma noktasını yaz (2–100 karakter).';
  if (form.address.trim().length > 200) errors.address = 'Adres en fazla 200 karakter olabilir.';
  let coords: { lat: number; lng: number } | null = null;
  if (form.location.trim()) {
    coords = parseCoords(form.location);
    if (!coords) errors.location = 'Konumu “41.0082, 28.9784” biçiminde ya da harita bağlantısı olarak yapıştır.';
  }
  let capacity: number | null = null;
  if (form.capacity.trim()) {
    capacity = Number(form.capacity.trim());
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 500) errors.capacity = 'Kontenjan 2–500 arasında olmalı ya da boş bırakılmalı.';
  }
  if (Object.values(errors).some(Boolean) || !when) return { errors, input: null };
  return {
    errors,
    input: {
      title,
      description: form.description.trim(),
      startsAt: when.toISOString(),
      city,
      placeName: place,
      address: form.address.trim(),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      capacity,
      matchId: form.matchId,
    },
  };
}

/** Suggests a meet-up time 3 hours before kickoff (form helper). */
export function suggestFromKickoff(kickoffIso: string): { date: string; time: string } {
  const d = new Date(new Date(kickoffIso).getTime() - 3 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
}
