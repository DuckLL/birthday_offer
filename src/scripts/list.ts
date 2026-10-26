// 列表頁的篩選、排序、地圖切換。所有 .item 都已由伺服器輸出，這裡只切換 hidden 與 CSS order
// 上方篩選列（手機）和表頭 popover（桌機）都是 [data-f] 控制項，共用同一個 state
import { NATIONWIDE, ONLINE, isStale } from '../lib/shared';
import { loadMarks, onMarksChange } from './marks';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

const MULTI = ['cat', 'plat', 'period'] as const;
type Multi = (typeof MULTI)[number];

interface State {
  q: string;
  region: string;
  sort: string; // `${欄位}-${asc|desc}`
  cat: string[];
  plat: string[];
  period: string[];
  status: string;
  age: string;
  min: number;
  free: boolean;
  view: 'list' | 'map';
}

const empty = (): Omit<State, 'sort' | 'view'> => ({ q: '', region: '', cat: [], plat: [], period: [], status: '', age: '', min: 0, free: false });

// 第一次點表頭時的方向：數字與日期由大到小，其餘由小到大
const DESC_FIRST = new Set(['value', 'updated']);
// 舊版存的排序值
const LEGACY: Record<string, string> = { name: 'name-asc', plan: 'plan-asc', ratio: 'ratio-asc', min: 'min-asc' };

const isMulti = (f: string): f is Multi => (MULTI as readonly string[]).includes(f);

export function initList() {
  const root = document.querySelector<HTMLElement>('.filters');
  if (!root) return;
  const kind = root.dataset.kind!;
  const storeKey = `hbd:filters:${kind}:v1`;
  const items = [...document.querySelectorAll<HTMLElement>('.item')];
  const controls = [...document.querySelectorAll<HTMLElement>('[data-f]')];
  const unit = kind === 'r' ? '家' : '間';
  const defaultSort = document.querySelector<HTMLSelectElement>('select[data-f=sort]')!.options[0].value;
  const sortable = (s: unknown): s is string =>
    typeof s === 'string' && /^[a-z]+-(asc|desc)$/.test(s) && !!document.querySelector(`[data-sort-col="${s.split('-')[0]}"]`);

  const state: State = { ...empty(), sort: defaultSort, view: 'list' };

  try {
    const saved = JSON.parse(localStorage.getItem(storeKey) || '{}');
    for (const k of ['q', 'region', 'status', 'age'] as const) if (typeof saved[k] === 'string') state[k] = saved[k];
    if (typeof saved.min === 'number') state.min = saved.min;
    if (typeof saved.free === 'boolean') state.free = saved.free;
    if (saved.view === 'map' || saved.view === 'list') state.view = saved.view;
    // 舊版：cats 陣列、plat / period 單選字串
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : typeof v === 'string' && v ? [v] : []);
    state.cat = arr(saved.cat ?? saved.cats);
    state.plat = arr(saved.plat);
    state.period = arr(saved.period);
    const sort = LEGACY[saved.sort] ?? saved.sort;
    if (sortable(sort)) state.sort = sort;
  } catch {}
  // 網址 ?q= 可以直接帶搜尋字
  const urlQ = new URLSearchParams(location.search).get('q');
  if (urlQ) state.q = urlQ;

  /** 表頭排出來的組合不一定在下拉選單裡，臨時補一個選項 */
  function setSortSelect(sel: HTMLSelectElement) {
    sel.querySelector('option[data-custom]')?.remove();
    if (![...sel.options].some((o) => o.value === state.sort)) {
      const [col, dir] = state.sort.split('-');
      const label = document.querySelector(`[data-sort-col="${col}"]`)?.textContent?.trim() ?? col;
      const o = new Option(`${label}（${dir === 'asc' ? '小 → 大' : '大 → 小'}）`, state.sort);
      o.dataset.custom = '';
      sel.add(o);
    }
    sel.value = state.sort;
  }

  /** 把 state 寫回所有控制項（上方列 + 表頭 popover） */
  function render() {
    for (const el of controls) {
      const f = el.dataset.f!;
      if (el instanceof HTMLButtonElement) {
        el.setAttribute('aria-pressed', String(isMulti(f) && state[f].includes(el.dataset.v!)));
      } else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        el.checked = isMulti(f) ? state[f].includes(el.value) : state.free;
      } else if (el instanceof HTMLSelectElement) {
        if (f === 'sort') setSortSelect(el);
        else el.value = state[f as 'region' | 'status' | 'age'];
      } else if (el instanceof HTMLInputElement && document.activeElement !== el) {
        el.value = f === 'min' ? (state.min ? String(state.min) : '') : state.q;
      }
    }
    const [col, dir] = state.sort.split('-');
    document.querySelectorAll<HTMLElement>('.th[data-col]').forEach((th) => {
      if (th.dataset.col === col) th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
    // 表頭漏斗：該欄有篩選時亮起
    const active: Record<string, boolean> = {
      cat: state.cat.length > 0,
      plat: state.plat.length > 0,
      period: state.period.length > 0,
      region: !!state.region,
      age: !!state.age,
      status: !!state.status,
      value: state.min > 0 || state.free,
    };
    document.querySelectorAll<HTMLElement>('[data-filter-btn]').forEach((b) => b.toggleAttribute('data-active', !!active[b.dataset.filterBtn!]));
  }

  function apply() {
    const s = state;
    const marks = loadMarks();
    const now = new Date();
    let shown = 0,
      sum = 0;
    const visible: HTMLElement[] = [];
    const q = s.q.trim().toLowerCase();
    for (const el of items) {
      const d = el.dataset;
      const m = marks[d.key!];
      el.dataset.status = m?.status ?? '';
      const regions = (d.regions || '').split('|').filter(Boolean);
      const ok =
        (!q || d.q!.includes(q)) &&
        (!s.region || regions.includes(s.region) || (s.region !== ONLINE && regions.includes(NATIONWIDE))) &&
        (!s.cat.length || s.cat.includes(d.cat!)) &&
        (!s.plat.length || s.plat.includes(d.plat!)) &&
        (!s.period.length || s.period.includes(d.period!)) &&
        (!s.free || d.free === '1') &&
        (!s.min || Number(d.value) >= s.min) &&
        (!s.age || (s.age === 'stale') === isStale(d.updated, now)) &&
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

    const [col, dir] = s.sort.split('-');
    const sign = dir === 'desc' ? -1 : 1;
    const num = (el: HTMLElement, k: string) => Number(el.dataset[k]) || 0;
    const byName = (a: HTMLElement, b: HTMLElement) => a.dataset.name!.localeCompare(b.dataset.name!, 'zh-Hant');
    // 空值（未註明平台、沒排日期…）不論方向都放最後
    const text = (a = '', b = '', none: string) => (a === b ? 0 : a === none ? 1 : b === none ? -1 : sign * a.localeCompare(b, 'zh-Hant'));
    const cmp = (a: HTMLElement, b: HTMLElement): number => {
      switch (col) {
        case 'name':
          return sign * byName(a, b);
        case 'cat':
        case 'plat':
        case 'period':
          return text(a.dataset[col], b.dataset[col], '-');
        case 'plan':
          return text(marks[a.dataset.key!]?.plan, marks[b.dataset.key!]?.plan, '');
        case 'updated':
          return text(a.dataset.updated, b.dataset.updated, '');
        case 'region':
          return sign * (num(a, 'rrank') - num(b, 'rrank'));
        case 'value':
        case 'ratio':
        case 'min':
          return sign * (num(a, col) - num(b, col));
        default:
          return 0;
      }
    };
    const sorted = [...visible].sort((a, b) => cmp(a, b) || num(b, 'value') - num(a, 'value') || byName(a, b));
    sorted.forEach((el, i) => (el.style.order = String(i)));

    $('empty')!.hidden = shown > 0;
    const sumText = kind === 'r' ? `，合計價值 <b>$${sum.toLocaleString('zh-TW')}</b>` : `，合計可折 <b>$${sum.toLocaleString('zh-TW')}</b>`;
    $('result-text')!.innerHTML = `顯示 <b>${shown}</b> / ${items.length} ${unit}${sumText}`;
    document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => (el.textContent = `${shown} ${unit}`));

    const extra = [s.plat.length, s.period.length, s.status, s.age, s.min, s.free].filter(Boolean).length;
    const badge = $('more-badge');
    if (badge) {
      badge.hidden = !extra;
      badge.textContent = String(extra);
    }
    document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === s.view)));
    $('list')!.hidden = s.view !== 'list';
    const mapView = $('map-view');
    if (mapView) {
      mapView.hidden = s.view !== 'map';
      if (s.view === 'map') {
        import('./map').then((m) => m.showPins(new Set(visible.map((el) => el.dataset.key!))));
      }
    }
    render();
    try {
      localStorage.setItem(storeKey, JSON.stringify(s));
    } catch {}
  }

  function setField(el: HTMLElement) {
    const f = el.dataset.f!;
    if (isMulti(f)) {
      const v = el instanceof HTMLButtonElement ? el.dataset.v! : (el as HTMLInputElement).value;
      const on = el instanceof HTMLButtonElement ? !state[f].includes(v) : (el as HTMLInputElement).checked;
      state[f] = on ? [...new Set([...state[f], v])] : state[f].filter((x) => x !== v);
    } else if (f === 'free') state.free = (el as HTMLInputElement).checked;
    else if (f === 'min') state.min = Math.max(0, Number((el as HTMLInputElement).value) || 0);
    else if (f === 'q' || f === 'region' || f === 'status' || f === 'age' || f === 'sort') state[f] = (el as HTMLInputElement | HTMLSelectElement).value;
  }

  let t: number | undefined;
  document.addEventListener('input', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('input[data-f=q], input[data-f=min]');
    if (!el) return;
    setField(el);
    clearTimeout(t);
    t = window.setTimeout(apply, 120);
  });
  document.addEventListener('change', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-f]');
    if (!el || el.matches('input[data-f=q], input[data-f=min]')) return;
    setField(el);
    apply();
  });
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const chip = target.closest<HTMLButtonElement>('button[data-f]');
    if (chip) {
      setField(chip);
      return apply();
    }
    const th = target.closest<HTMLButtonElement>('[data-sort-col]');
    if (th) {
      const col = th.dataset.sortCol!;
      const [cur, dir] = state.sort.split('-');
      state.sort = `${col}-${cur === col ? (dir === 'asc' ? 'desc' : 'asc') : DESC_FIRST.has(col) ? 'desc' : 'asc'}`;
      return apply();
    }
    const clear = target.closest<HTMLElement>('[data-clear]');
    if (clear) {
      const f = clear.dataset.clear!;
      if (isMulti(f)) state[f] = [];
      else if (f === 'min') Object.assign(state, { min: 0, free: false });
      else if (f === 'region' || f === 'status' || f === 'age') state[f] = '';
      return apply();
    }
    if (target.closest('[data-reset]')) {
      Object.assign(state, empty());
      return apply();
    }
    const view = target.closest<HTMLButtonElement>('[data-view]');
    if (view) {
      state.view = view.dataset.view as State['view'];
      apply();
    }
  });

  // 表頭 popover 預設在畫面正中，改成貼在漏斗按鈕下方
  document.querySelectorAll<HTMLElement>('.pop[popover]').forEach((pop) => {
    pop.addEventListener('toggle', (e) => {
      if ((e as ToggleEvent).newState !== 'open') return;
      const btn = document.querySelector<HTMLElement>(`[popovertarget="${pop.id}"]`);
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const w = pop.offsetWidth;
      pop.style.top = `${r.bottom + 6}px`;
      pop.style.left = `${Math.max(8, Math.min(r.right - w, innerWidth - w - 8))}px`;
    });
  });
  addEventListener('scroll', () => document.querySelectorAll<HTMLElement>('.pop:popover-open').forEach((p) => p.hidePopover()), { passive: true });

  // 篩選區捲出畫面後，顯示固定在 navbar 下方的一行搜尋列
  const sticky = $('sticky-filter');
  if (sticky) {
    const head = document.querySelector<HTMLElement>('.site-head');
    const show = (on: boolean) => {
      sticky.classList.toggle('on', on);
      sticky.toggleAttribute('inert', !on);
      sticky.setAttribute('aria-hidden', String(!on));
    };
    new IntersectionObserver(([e]) => show(!e.isIntersecting && e.boundingClientRect.top < (head?.offsetHeight ?? 56)), {
      rootMargin: `-${head?.offsetHeight ?? 56}px 0px 0px 0px`,
    }).observe(root);
    sticky.querySelector('[data-to-filters]')?.addEventListener('click', () => {
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // 點卡片空白處也打開詳細資訊（手機上比點店名好按）
  for (const el of items) {
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a, button, input, label, select, textarea')) return;
      el.querySelector<HTMLAnchorElement>('.c-name a')?.click();
    });
  }

  onMarksChange(apply);
  apply();
}
