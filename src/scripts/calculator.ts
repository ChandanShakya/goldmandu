import { formatNPR, loadPriceHistory, safePrice } from '../lib/prices';
import {
  type WeightUnit,
  convertAll,
  fromGrams,
  toGrams,
  tolaAanaPhrase,
  GRAM_PER_TOLA,
} from '../lib/units';

const KARAT: Record<string, number> = {
  '24K': 0.999,
  '22K': 0.916,
  '18K': 0.75,
  '14K': 0.585,
  '10K': 0.417,
};

const prices = {
  fine_gold_tola: 0,
  fine_gold_gram: 0,
  tejabi_gold_tola: 0,
  tejabi_gold_gram: 0,
  silver_tola: 0,
  silver_gram: 0,
};

function num(id: string): number {
  const el = document.getElementById(id) as HTMLInputElement | null;
  return el ? parseFloat(el.value) : NaN;
}

function setResult(id: string, html: string, ok = true) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = html;
  el.classList.toggle('pending', !ok);
}

function round3(n: number): string {
  return Number.isFinite(n) ? String(Number(n.toFixed(3))) : '—';
}

function metalPrice(metal: string, unit: 'tola' | 'gram'): number {
  if (metal === 'tejabi') {
    return unit === 'tola' ? prices.tejabi_gold_tola : prices.tejabi_gold_gram;
  }
  if (metal === 'silver') {
    return unit === 'tola' ? prices.silver_tola : prices.silver_gram;
  }
  return unit === 'tola' ? prices.fine_gold_tola : prices.fine_gold_gram;
}

async function loadPrices() {
  const rows = await loadPriceHistory();
  const latest = rows[rows.length - 1];
  prices.fine_gold_tola = safePrice(latest.fine_gold_tola) ?? 0;
  prices.fine_gold_gram = safePrice(latest.fine_gold_gram) ?? 0;
  prices.tejabi_gold_tola = safePrice(latest.tejabi_gold_tola) ?? 0;
  prices.tejabi_gold_gram = safePrice(latest.tejabi_gold_gram) ?? 0;
  prices.silver_tola = safePrice(latest.silver_tola) ?? 0;
  prices.silver_gram = safePrice(latest.silver_gram) ?? 0;

  const karat = document.getElementById('karat24') as HTMLInputElement | null;
  if (karat && !karat.value) karat.value = String(prices.fine_gold_tola);
}

function wire() {
  document.getElementById('btn-convert')?.addEventListener('click', () => {
    const w = num('convertWeight');
    const from = (
      document.getElementById('convertFrom') as HTMLSelectElement
    ).value as WeightUnit;
    if (!w || !Number.isFinite(w) || w <= 0) {
      setResult('convertResult', 'Enter a positive weight to convert.', false);
      return;
    }
    const rows = convertAll(w, from);
    const table = rows
      .map((r) => {
        const mark = r.unit === from ? ' ← input' : '';
        return `<div>${r.label}: <strong>${r.value}</strong>${mark}</div>`;
      })
      .join('');
    const phrase = tolaAanaPhrase(toGrams(w, from));
    setResult(
      'convertResult',
      `${table}<div style="margin-top:0.4rem">Jewelry style: <strong>${phrase}</strong></div>`,
    );
  });

  document.getElementById('btn-price')?.addEventListener('click', () => {
    const metal = (document.getElementById('priceMetal') as HTMLSelectElement).value;
    const unit = (document.getElementById('priceUnit') as HTMLSelectElement).value as
      | 'tola'
      | 'gram';
    const w = num('priceWeight');
    if (!w || !Number.isFinite(w)) {
      setResult('priceResult', 'Enter a weight to price the metal.', false);
      return;
    }
    const unitPrice = metalPrice(metal, unit);
    setResult(
      'priceResult',
      `${w} ${unit} × ${formatNPR(unitPrice)} = <strong>${formatNPR(w * unitPrice)}</strong>`,
    );
  });

  document.getElementById('btn-jewelry')?.addEventListener('click', () => {
    const w = num('jewelryWeight');
    const unit = (
      (document.getElementById('jewelryUnit') as HTMLSelectElement | null)?.value ||
      'tola'
    ) as WeightUnit;
    const mc = num('makingCharge') || 0;
    const wast = num('wastage') || 0;
    if (!w || !Number.isFinite(w) || w <= 0) {
      setResult('jewelryResult', 'Enter a positive gold weight.', false);
      return;
    }
    const tola = fromGrams(toGrams(w, unit), 'tola');
    const grams = toGrams(w, unit);
    const gold = tola * prices.fine_gold_tola;
    const making = tola * mc;
    const waste = gold * (wast / 100);
    setResult(
      'jewelryResult',
      `${round3(grams)} g (${tolaAanaPhrase(grams)}) · ` +
        `Gold ${formatNPR(gold)} + making ${formatNPR(making)} + wastage ${formatNPR(waste)} ` +
        `= <strong>${formatNPR(gold + making + waste)}</strong>`,
    );
  });

  document.getElementById('btn-karat')?.addEventListener('click', () => {
    const base = num('karat24') || prices.fine_gold_tola;
    setResult(
      'karatResult',
      Object.entries(KARAT)
        .map(([k, p]) => `${k}: <strong>${formatNPR(base * p)}</strong>`)
        .join('<br>'),
    );
  });

  document.getElementById('btn-invest')?.addEventListener('click', () => {
    const initial = num('invInitial') || 0;
    const monthly = num('invMonthly') || 0;
    const years = num('invYears') || 1;
    const r = (num('invReturn') || 8) / 100 / 12;
    const n = years * 12;
    const fvInitial = initial * Math.pow(1 + r, n);
    const fvSip =
      r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    const invested = initial + monthly * n;
    const fv = fvInitial + fvSip;
    setResult(
      'investResult',
      `Invested ${formatNPR(invested)} → <strong>${formatNPR(fv)}</strong> (gain ${formatNPR(fv - invested)})`,
    );
  });
}

loadPrices().catch(console.error);
wire();
