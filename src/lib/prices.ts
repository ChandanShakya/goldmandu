export type PriceRecord = {
  day: string;
  month: string;
  year: string;
  fine_gold_gram: string;
  tejabi_gold_gram: string;
  silver_gram: string;
  fine_gold_tola: string;
  tejabi_gold_tola: string;
  silver_tola: string;
};

export function safePrice(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** South Asian NPR grouping: Rs. 3,02,200 */
export function formatNPR(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return 'N/A';
  const s = Math.round(n).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return (
    'Rs. ' +
    (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3)
  );
}

export function latestValid(records: PriceRecord[]): PriceRecord | null {
  for (let i = records.length - 1; i >= 0; i--) {
    if (safePrice(records[i]?.fine_gold_tola) !== null) return records[i];
  }
  return null;
}

export function computeInsights(records: PriceRecord[]) {
  const valid = records.filter((r) => safePrice(r.fine_gold_tola) !== null);
  if (valid.length < 2) return null;

  const latest = valid[valid.length - 1];
  const prev = valid[valid.length - 2];
  const todayPrice = safePrice(latest.fine_gold_tola);
  const prevPrice = safePrice(prev.fine_gold_tola);
  const change =
    todayPrice != null && prevPrice != null ? todayPrice - prevPrice : null;
  const changePct =
    change != null && prevPrice
      ? Number(((change / prevPrice) * 100).toFixed(2))
      : null;

  const last7 = valid
    .slice(-7)
    .map((r) => safePrice(r.fine_gold_tola))
    .filter((v): v is number => v != null);
  const ma7 =
    last7.length >= 3
      ? Math.round(last7.reduce((a, b) => a + b, 0) / last7.length)
      : null;

  const monthRecords = valid.filter(
    (r) => r.month === latest.month && r.year === latest.year,
  );
  const monthPrices = monthRecords
    .map((r) => safePrice(r.fine_gold_tola))
    .filter((v): v is number => v != null);
  const monthHigh = monthPrices.length ? Math.max(...monthPrices) : null;
  const monthLow = monthPrices.length ? Math.min(...monthPrices) : null;

  const silver = safePrice(latest.silver_tola);
  const ratio =
    todayPrice != null && silver
      ? Number((todayPrice / silver).toFixed(1))
      : null;

  return {
    todayPrice,
    prevPrice,
    change,
    changePct,
    ma7,
    monthHigh,
    monthLow,
    ratio,
    latest,
  };
}

export async function loadPriceHistory(): Promise<PriceRecord[]> {
  const res = await fetch('/data/prices.json');
  if (!res.ok) throw new Error(`prices.json HTTP ${res.status}`);
  const rows = (await res.json()) as PriceRecord[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('prices.json empty');
  }
  return rows;
}
