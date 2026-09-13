/**
 * Nepali / South Asian precious-metal weights.
 *
 * Market convention in Nepal (Fenegosida + jewelers):
 *   1 tola  = 11.66 g          (site uses 11.66; association also publishes per 10 g)
 *   1 aana  = 1/16 tola        (common jewelry quote: “2 tola 8 aana”)
 *   1 masha = 1/12 tola
 *   1 ratti = 1/96 tola        (also called “lal”)
 */

export const GRAM_PER_TOLA = 11.66;
export const AANA_PER_TOLA = 16;
export const MASHA_PER_TOLA = 12;
export const RATTI_PER_TOLA = 96;

export type WeightUnit = 'gram' | 'tola' | 'aana' | 'masha' | 'ratti';

export const UNIT_LABELS: Record<WeightUnit, string> = {
  gram: 'Gram',
  tola: 'Tola',
  aana: 'Aana (आना)',
  masha: 'Masha (माशा)',
  ratti: 'Ratti / Lal (रत्ती)',
};

/** Convert any supported unit → grams. */
export function toGrams(value: number, unit: WeightUnit): number {
  switch (unit) {
    case 'gram':
      return value;
    case 'tola':
      return value * GRAM_PER_TOLA;
    case 'aana':
      return (value / AANA_PER_TOLA) * GRAM_PER_TOLA;
    case 'masha':
      return (value / MASHA_PER_TOLA) * GRAM_PER_TOLA;
    case 'ratti':
      return (value / RATTI_PER_TOLA) * GRAM_PER_TOLA;
    default:
      return value;
  }
}

/** Convert grams → any supported unit. */
export function fromGrams(grams: number, unit: WeightUnit): number {
  switch (unit) {
    case 'gram':
      return grams;
    case 'tola':
      return grams / GRAM_PER_TOLA;
    case 'aana':
      return (grams / GRAM_PER_TOLA) * AANA_PER_TOLA;
    case 'masha':
      return (grams / GRAM_PER_TOLA) * MASHA_PER_TOLA;
    case 'ratti':
      return (grams / GRAM_PER_TOLA) * RATTI_PER_TOLA;
    default:
      return grams;
  }
}

function round(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '—';
  const r = Number(n.toFixed(digits));
  return String(r);
}

/**
 * Break a gram amount into tola + aana (jewelry style), e.g. “2 tola 8 aana”.
 * Residual aana is shown with 2 decimals when not a whole aana.
 */
export function tolaAanaPhrase(grams: number): string {
  const tola = grams / GRAM_PER_TOLA;
  const wholeTola = Math.floor(tola + 1e-9);
  const aana = (tola - wholeTola) * AANA_PER_TOLA;
  const wholeAana = Math.floor(aana + 1e-9);
  const aanaFrac = aana - wholeAana;

  if (wholeTola === 0 && wholeAana === 0) {
    return `${round(aana, 2)} aana`;
  }
  let s = '';
  if (wholeTola > 0) s += `${wholeTola} tola`;
  if (wholeAana > 0) s += `${s ? ' ' : ''}${wholeAana} aana`;
  if (aanaFrac > 0.01 && wholeTola + wholeAana > 0) {
    s += ` ${round(aanaFrac, 2)} aana-fraction`;
  }
  return s || '0';
}

export type ConversionRow = { unit: WeightUnit; label: string; value: string };

/** Full conversion table from one input weight. */
export function convertAll(value: number, from: WeightUnit): ConversionRow[] {
  const grams = toGrams(value, from);
  const units: WeightUnit[] = ['gram', 'tola', 'aana', 'masha', 'ratti'];
  return units.map((u) => ({
    unit: u,
    label: UNIT_LABELS[u],
    value: u === 'gram' ? round(grams, 3) : round(fromGrams(grams, u), 3),
  }));
}
