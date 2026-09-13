import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  Filler,
} from 'chart.js';

import { formatNPR, loadPriceHistory, safePrice, type PriceRecord } from '../lib/prices';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  Filler,
);

type ChartKey = 'fineGold' | 'tejabiGold' | 'silver';
const KEYS: ChartKey[] = ['fineGold', 'tejabiGold', 'silver'];

const META: Record<ChartKey, { color: string; fill: string; canvas: string }> = {
  fineGold: { color: '#8a7014', fill: 'rgba(138,112,20,0.12)', canvas: 'fineGoldChart' },
  tejabiGold: { color: '#6b5a1e', fill: 'rgba(107,90,30,0.10)', canvas: 'tejabiGoldChart' },
  silver: { color: '#555555', fill: 'rgba(85,85,85,0.08)', canvas: 'silverChart' },
};

type Series = {
  labels: string[];
  fineGold: (number | null)[];
  tejabiGold: (number | null)[];
  silver: (number | null)[];
};

let allData: Series | null = null;
const charts: Partial<Record<ChartKey, Chart>> = {};
const activeRange: Partial<Record<ChartKey, string>> = {};

function sliceRange(data: Series, range: string): Series {
  const total = data.labels.length;
  let from = 0;
  if (range === '1M') from = Math.max(0, total - 30);
  else if (range === '6M') from = Math.max(0, total - 182);
  else if (range === '1Y') from = Math.max(0, total - 365);
  return {
    labels: data.labels.slice(from),
    fineGold: data.fineGold.slice(from),
    tejabiGold: data.tejabiGold.slice(from),
    silver: data.silver.slice(from),
  };
}

function sliceCustom(data: Series, fromLabel: string, toLabel: string): Series {
  const a = data.labels.indexOf(fromLabel);
  const b = data.labels.indexOf(toLabel);
  if (a < 0 || b < 0) return data;
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  return {
    labels: data.labels.slice(start, end + 1),
    fineGold: data.fineGold.slice(start, end + 1),
    tejabiGold: data.tejabiGold.slice(start, end + 1),
    silver: data.silver.slice(start, end + 1),
  };
}

function maxPoints(): number {
  const w = window.innerWidth;
  if (w < 480) return 80;
  if (w < 900) return 120;
  return 180;
}

function thin(labels: string[], values: (number | null)[], cap: number) {
  const n = labels.length;
  if (n <= cap) return { labels, values };
  const L: string[] = [];
  const V: (number | null)[] = [];
  const step = (n - 1) / (cap - 1);
  for (let i = 0; i < cap; i++) {
    const idx = Math.round(i * step);
    L.push(labels[idx]);
    V.push(values[idx]);
  }
  return { labels: L, values: V };
}

function labelAt(labels: string[], i: number): string {
  return labels[Math.max(0, Math.min(labels.length - 1, Math.round(i)))] ?? '';
}

function options(labels: string[]) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111',
        titleFont: { size: 11, family: 'Arial' },
        bodyFont: { size: 11, family: 'Courier New' },
        padding: 8,
        displayColors: false,
        callbacks: {
          title(items: { parsed?: { x?: number } }[]) {
            return labelAt(labels, items[0]?.parsed?.x ?? 0);
          },
          label(ctx: { parsed: { y: number | null } }) {
            return ctx.parsed.y == null ? '' : formatNPR(ctx.parsed.y);
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        min: 0,
        max: Math.max(1, labels.length - 1),
        ticks: {
          autoSkip: true,
          maxTicksLimit: window.innerWidth < 480 ? 4 : 6,
          color: '#333',
          font: { size: 10, family: 'Arial' },
          callback(value: string | number) {
            return labelAt(labels, Number(value));
          },
        },
        grid: { color: 'rgba(0,0,0,0.08)' },
        border: { color: '#222' },
      },
      y: {
        beginAtZero: false,
        ticks: {
          color: '#333',
          font: { size: 10, family: 'Courier New' },
          callback(value: string | number) {
            const n = Number(value);
            if (!Number.isFinite(n)) return '';
            if (n >= 1000) return `${Math.round(n / 1000)}k`;
            return String(n);
          },
        },
        grid: { color: 'rgba(0,0,0,0.08)' },
        border: { color: '#222' },
      },
    },
    elements: {
      point: { radius: 0, hitRadius: 10, hoverRadius: 3 },
      line: { borderWidth: 1.5, tension: 0 },
    },
    spanGaps: false,
  };
}

function render(key: ChartKey, data: Series) {
  const { labels, values } = thin(data.labels, data[key], maxPoints());
  const dataset = {
    // x = index — unique; avoids duplicate BS labels spiking the line
    data: values.map((y, i) => ({ x: i, y })),
    borderColor: META[key].color,
    backgroundColor: META[key].fill,
    fill: true,
    label: key,
  };
  const chart = charts[key];
  if (!chart) {
    const el = document.getElementById(META[key].canvas) as HTMLCanvasElement | null;
    const ctx = el?.getContext('2d');
    if (!ctx) return;
    charts[key] = new Chart(ctx, {
      type: 'line',
      data: { datasets: [dataset] },
      options: options(labels),
    });
    return;
  }
  chart.data.datasets[0] = dataset;
  chart.options = options(labels);
  chart.update('none');
}

function applyRange(key: ChartKey, range: string) {
  if (!allData || range === 'Custom') return;
  activeRange[key] = range;
  render(key, sliceRange(allData, range));
}

function fillSelects(data: Series) {
  const desc = [...data.labels].reverse().slice(0, 800);
  const html = desc.map((l) => `<option value="${l}">${l}</option>`).join('');
  for (const key of KEYS) {
    const from = document.querySelector<HTMLSelectElement>(`[data-from="${key}"]`);
    const to = document.querySelector<HTMLSelectElement>(`[data-to="${key}"]`);
    if (!from || !to) continue;
    from.innerHTML = html;
    to.innerHTML = html;
    from.selectedIndex = 0;
    to.selectedIndex = Math.min(29, desc.length - 1);
  }
}

function wire() {
  document.querySelectorAll<HTMLButtonElement>('.range-btn[data-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!allData) return;
      const key = btn.dataset.chart as ChartKey;
      const range = btn.dataset.range || '6M';
      const group = btn.closest('.range-group');
      group?.querySelectorAll('.range-btn').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      const custom = document.querySelector<HTMLElement>(`[data-custom="${key}"]`);
      if (range === 'Custom') {
        custom?.classList.add('open');
        return;
      }
      custom?.classList.remove('open');
      applyRange(key, range);
    });
  });

  for (const key of KEYS) {
    document.querySelector(`[data-apply="${key}"]`)?.addEventListener('click', () => {
      if (!allData) return;
      const from = document.querySelector<HTMLSelectElement>(`[data-from="${key}"]`)?.value;
      const to = document.querySelector<HTMLSelectElement>(`[data-to="${key}"]`)?.value;
      if (!from || !to) return;
      render(key, sliceCustom(allData, from, to));
    });
  }
}

function fromRecords(rows: PriceRecord[]): Series {
  const labels: string[] = [];
  const fineGold: (number | null)[] = [];
  const tejabiGold: (number | null)[] = [];
  const silver: (number | null)[] = [];
  for (const r of rows) {
    labels.push(`${r.day} ${r.month} ${r.year}`);
    fineGold.push(safePrice(r.fine_gold_tola));
    tejabiGold.push(safePrice(r.tejabi_gold_tola));
    silver.push(safePrice(r.silver_tola));
  }
  return { labels, fineGold, tejabiGold, silver };
}

async function init() {
  const rows = await loadPriceHistory();
  allData = fromRecords(rows);
  fillSelects(allData);

  const range = window.innerWidth < 768 ? '6M' : '1Y';
  for (const key of KEYS) {
    activeRange[key] = range;
    render(key, sliceRange(allData, range));
  }
  document.querySelectorAll<HTMLButtonElement>('.range-btn[data-range]').forEach((btn) => {
    const on = btn.dataset.range === range;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  wire();
}

init().catch((err) => console.error('chart init failed', err));
