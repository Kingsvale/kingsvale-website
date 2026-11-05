const postcodePattern = /\b(?:GIR\s*0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;
const addressWords = new RegExp(`${postcodePattern.source}|[\\p{L}\\p{N}]+(?:['’][\\p{L}]+)*`, "giu");
const smallWords = new Set("and at by de du for in la of on the to upon van von".split(" "));
const abbreviations = new Set("BFPO HM HMP LLP PLC PO RAF RNAS UK GB II III IV VI VII VIII IX XI XII XIII XIV XV XVI".split(" "));

/** Format pasted text only; leave manually chosen mixed-case names intact. */
export function formatPastedAddress(value: string): string {
  return value.replace(addressWords, (word: string, offset: number) => {
    if (postcodePattern.test(word)) {
      const postcode = word.replace(/\s/g, "").toUpperCase();
      return `${postcode.slice(0, -3)} ${postcode.slice(-3)}`;
    }
    const lower = word.toLowerCase();
    const upper = word.toUpperCase();
    if (abbreviations.has(upper)) return upper;
    if (/^\d+(?:st|nd|rd|th)$/i.test(word)) return lower;
    if (/\d/.test(word)) return upper;
    const segmentPrefix = value.slice(0, offset).split(/[,;\r\n]/).at(-1) ?? "";
    if (smallWords.has(lower) && /\p{L}/u.test(segmentPrefix)) return lower;
    if (word !== lower && word !== upper) return word;
    return lower.replace(/^\p{L}/u, (letter) => letter.toUpperCase())
      .replace(/^([OD])(['’])(\p{L})/u, (_match, prefix: string, apostrophe: string, letter: string) => prefix + apostrophe + letter.toUpperCase())
      .replace(/^Mc(\p{L})/u, (_match, letter: string) => "Mc" + letter.toUpperCase());
  });
}
