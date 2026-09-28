/**
 * Soft profanity check for Turkish forum posts.
 *
 * Used before sending: when a message contains strong insults or profanity the composer asks the member to
 * edit it ("Yine de gönder" stays possible — moderators decide, not the word list). Matching is on whole
 * words after normalising case, Turkish letters, look-alike characters (0→o, 1→i, @→a, $→s…), dotted or
 * spaced spellings (s.i.k.t.i.r) and stretched letters (siiiiktir). Harmless words that merely share a root
 * (götür, siklet, sikke, amatör…) do not match.
 */

// Word roots: a token matches when it starts with the root (after folding ş→s, ç→c, ğ→g, ö→o, ü→u).
// "ı" is deliberately NOT folded to "i": sıkı, sıkış, sık (tight/squeeze/often) are everyday football words.
const ROOTS = [
  'orospu', 'siktir', 'sikerim', 'sikeyim', 'sikiyim', 'siktig', 'sikis', 'sikik', 'yarrak', 'dalyarak',
  'amcık', 'amcik', 'amına', 'amina', 'amını', 'amini',
  'pezevenk', 'kahpe', 'yavsak', 'kaltak', 'serefsiz', 'ibne', 'gavat', 'pust',
];

// Whole tokens only, compared before folding so that e.g. English "got" / "pic" are not flagged.
const EXACT = ['amk', 'aq', 'amq', 'oç', 'piç', 'göt', 'götveren', 'götlek', 'sik', 'siq'];
// Tokens that must never match even though they start with a root.
const SAFE = new Set(['sikke', 'sikkeler', 'siklet', 'sikletinde', 'amino', 'aminoasit']);

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };
const FOLD: Record<string, string> = { ş: 's', ç: 'c', ğ: 'g', ö: 'o', ü: 'u', â: 'a', î: 'i', û: 'u' };

function normaliseToken(raw: string): string {
  return raw
    .toLocaleLowerCase('tr-TR')
    .split('')
    .map((c) => LEET[c] ?? c)
    .join('')
    .replace(/(.)\1{2,}/g, '$1');
}

const fold = (s: string) => s.replace(/[şçğöüâîû]/g, (c) => FOLD[c] ?? c);

// Explicit letter class instead of \p{L}: works on every JS engine (Hermes included).
const L = 'a-zA-ZçğıöşüâîûÇĞİÖŞÜÂÎÛ0-9@$!';
const SPELLED = new RegExp(`(^|\\s)((?:[${L}][.\\-_*\\s]){2,}[${L}])(?=\\s|$|[.,!?])`, 'g');
const SPLIT = new RegExp(`[^${L}]+`);

/** Joins single letters separated by dots/spaces/dashes ("s.i.k.t.i.r" → "siktir") before tokenising. */
function collapseSpelledOut(text: string): string {
  return text.replace(SPELLED, (_m, pre: string, word: string) => pre + word.replace(/[.\-_*\s]/g, ''));
}

/** Returns the offending words as written (unique, max 5); empty when the text looks clean. */
export function findProfanity(text: string): string[] {
  const hits: string[] = [];
  const tokens = collapseSpelledOut(text).split(SPLIT).filter(Boolean);
  for (const raw of tokens) {
    const n = normaliseToken(raw);
    const f = fold(n);
    if (SAFE.has(f)) continue;
    const bad = EXACT.includes(n) || EXACT.map(fold).filter((e) => e.length > 3).includes(f) || ROOTS.some((r) => f.startsWith(fold(r)));
    if (bad && !hits.includes(raw)) hits.push(raw);
    if (hits.length >= 5) break;
  }
  return hits;
}

export function profanityWarning(hits: string[]): string {
  const list = hits.map((h) => `“${h}”`).join(', ');
  return `Mesajında hakaret ya da küfür sayılabilecek ifadeler var (${list}). Topluluk kuralları gereği bu tür mesajlar kaldırılabilir; düzenlemeni öneririz.`;
}
