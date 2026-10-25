// 列表頁的篩選、排序、地圖切換。所有 .item 都已由伺服器輸出，這裡只切換 hidden 與 CSS order
import { NATIONWIDE, ONLINE } from '../lib/shared';
import { loadMarks, onMarksChange } from './marks';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

interface State {
  q: string;
  region: string;
  sort: string;
  cats: string[];
  plat: string;
  period: string;
  status: string;
  free: boolean;
  view: 'list' | 'map';
}

export function initList() {
  const root = document.querySelector<HTMLElement>('.filters');
  if (!root) return;
  const kind = root.dataset.kind!;
  const storeKey = `hbd:filters:${kind}:v1`;
  const items = [...document.querySelectorAll<HTMLElement>('.item')];
  const q = $<HTMLInputElement>('f-q')!;
  const region = $<HTMLSelectElement>('f-region');
  const sort = $<HTMLSelectElement>('f-sort')!;
  const plat = $<HTMLSelectElement>('f-plat');
  const period = $<HTMLSelectElement>('f-period');
  const status = $<HTMLSelectElement>('f-status');
  const free = $<HTMLInputElement>('f-free');
  const catBtns = [...document.querySelectorAll<HTMLButtonElement>('#f-cats [data-cat]')];
  const viewBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-view]')];
  const unit = kind === 'r' ? '家' : '間';

  let view: State['view'] = 'list';

  const read = (): State => ({
    q: q.value.trim().toLowerCase(),
    region: region?.value ?? '',
    sort: sort.value,
    cats: catBtns.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.cat!),
    plat: plat?.value ?? '',
    period: period?.value ?? '',
    status: status?.value ?? '',
    free: free?.checked ?? false,
    view,
  });

  const write = (s: Partial<State>) => {
    if (s.q !== undefined) q.value = s.q;
    if (region && s.region !== undefined) region.value = s.region;
    if (s.sort) sort.value = s.sort;
    if (s.cats) catBtns.forEach((b) => b.setAttribute('aria-pressed', String(s.cats!.includes(b.dataset.cat!))));
    if (plat && s.plat !== undefined) plat.value = s.plat;
    if (period && s.period !== undefined) period.value = s.period;
    if (status && s.status !== undefined) status.value = s.status;
    if (free && s.free !== undefined) free.checked = s.free;
    if (s.view) view = s.view;
  };

  try {
    write(JSON.parse(localStorage.getItem(storeKey) || '{}'));
  } catch {}
  // 網址 ?q= 可以直接帶搜尋字
  const urlQ = new URLSearchParams(location.search).get('q');
  if (urlQ) q.value = urlQ;

  function apply() {
    const s = read();
    const marks = loadMarks();
    let shown = 0,
      sum = 0;
    const visible: HTMLElement[] = [];
    for (const el of items) {
      const d = el.dataset;
      const m = marks[d.key!];
      el.dataset.status = m?.status ?? '';
      const regions = (d.regions || '').split('|').filter(Boolean);
      const ok =
        (!s.q || d.q!.includes(s.q)) &&
        (!s.region || regions.includes(s.region) || (s.region !== ONLINE && regions.includes(NATIONWIDE))) &&
        (!s.cats.length || s.cats.includes(d.cat!)) &&
        (!s.plat || d.plat === s.plat) &&
        (!s.period || d.period === s.period) &&
        (!s.free || d.free === '1') &&
        (!s.status ||
          (s.status === 'none' && !m?.status && !m?.plan) ||
          (s.status === 'want' && m?.status === 'want') ||
          (s.status === 'done' && m?.status === 'done') ||
          (s.status === 'plan' && !!m?.plan) ||
          (s.status === 'hide-done' && m?.status !== 'done'));
      el.hidden = !ok;
      if (ok) {
        shown++;
        sum += Number(d.value) || 0;
        visible.push(el);
      }
    }
    const val = (el: HTMLElement) => Number(el.dataset.value) || 0;
    const sorted = [...visible].sort((a, b) => {
      switch (s.sort) {
        case 'value-asc':
          return val(a) - val(b);
        case 'name':
          return a.dataset.name!.localeCompare(b.dataset.name!, 'zh-Hant');
        case 'plan': {
          const pa = marks[a.dataset.key!]?.plan || '9999';
          const pb = marks[b.dataset.key!]?.plan || '9999';
          return pa.localeCompare(pb) || val(b) - val(a);
        }
        case 'ratio':
          return Number(a.dataset.ratio) - Number(b.dataset.ratio) || val(b) - val(a);
        case 'min':
          return Number(a.dataset.min) - Number(b.dataset.min);
        default:
          return val(b) - val(a);
      }
    });
    sorted.forEach((el, i) => (el.style.order = String(i)));
    $('empty')!.hidden = shown > 0;
    const sumText = kind === 'r' ? `，合計價值 <b>$${sum.toLocaleString('zh-TW')}</b>` : `，合計可折 <b>$${sum.toLocaleString('zh-TW')}</b>`;
    $('result-text')!.innerHTML = `顯示 <b>${shown}</b> / ${items.length} ${unit}${sumText}`;

    const extra = [s.plat, s.period, s.status, s.free ? '1' : ''].filter(Boolean).length;
    const badge = $('more-badge');
    if (badge) {
      badge.hidden = !extra;
      badge.textContent = String(extra);
    }
    viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    $('list')!.hidden = view !== 'list';
    const mapView = $('map-view');
    if (mapView) {
      mapView.hidden = view !== 'map';
      if (view === 'map') {
        import('./map').then((m) => m.showPins(new Set(visible.map((el) => el.dataset.key!))));
      }
    }
    try {
      localStorage.setItem(storeKey, JSON.stringify(s));
    } catch {}
  }

  let t: number | undefined;
  q.addEventListener('input', () => {
    clearTimeout(t);
    t = window.setTimeout(apply, 120);
  });
  for (const el of [region, sort, plat, period, status, free]) el?.addEventListener('change', apply);
  catBtns.forEach((b) =>
    b.addEventListener('click', () => {
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
      apply();
    }),
  );
  viewBtns.forEach((b) =>
    b.addEventListener('click', () => {
      view = b.dataset.view as State['view'];
      apply();
    }),
  );
  $('f-reset')?.addEventListener('click', () => {
    write({ q: '', region: '', cats: [], plat: '', period: '', status: '', free: false });
    apply();
  });
  document.querySelectorAll<HTMLButtonElement>('.list-head [data-sort]').forEach((b) =>
    b.addEventListener('click', () => {
      sort.value = b.dataset.sort!;
      apply();
    }),
  );
  onMarksChange(apply);
  apply();
}
