import { ForumError } from '../services/forum/repository';
import type { PollInput } from '../types/forum';
export function requireText(value: string, min: number, max: number) {
  const text = value.trim();
  if (text.length < min || text.length > max) throw new ForumError(`Metin ${min}–${max} karakter olmalı.`, 'validation');
  return text;
}
export function validatePage(cursor: number, size: number) {
  if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isInteger(size) || size < 1 || size > 100)
    throw new ForumError('Geçersiz sayfa.', 'validation');
}
export function mentionNames(body: string): string[] {
  return [...new Set(Array.from(body.matchAll(/(?:^|[^a-z0-9_@])@([a-z0-9_]{3,24})(?![a-z0-9_])/gi), m => m[1].toLowerCase()))];
}
export function validatePoll(poll?: PollInput) {
  if (!poll) return;
  requireText(poll.question, 3, 200);
  if (poll.options.length < 2 || poll.options.length > 6) throw new ForumError('Anket 2–6 seçenek içermeli.', 'validation');
  const options = poll.options.map(o => requireText(o, 1, 100).toLowerCase());
  if (new Set(options).size !== options.length) throw new ForumError('Anket seçenekleri farklı olmalı.', 'validation');
}
