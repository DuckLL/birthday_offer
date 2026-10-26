// 桌機表格欄位的順序與顯示：用一段 <style> 設定 grid 欄寬、各欄 order 與隱藏，設定存在 localStorage
import { COLUMNS, type Column } from '../lib/columns';
import type { Kind } from '../lib/shared';

interface Prefs {
  order: string[];
  hidden: string[];
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function initColumns(kind: Kind) {
  const cols = COLUMNS[kind];
  const byKey = new Map(cols.map((c) => [c.key, c]));
  const storeKey = `hbd:cols:${kind}:v1`;
  const defaults = (): Prefs => ({ order: cols.map((c) => c.key), hidden: [] });
  let prefs = defaults();

  try {
    const saved = JSON.parse(localStorage.getItem(storeKey) || 'null');
    if (saved && Array.isArray(saved.order)) {
      // 丟掉已不存在的欄位，新增的欄位接在最後
      const order = saved.order.filter((k: unknown) => typeof k === 'string' && byKey.has(k));
      prefs.order = [...new Set([...order, ...cols.map((c) => c.key)])];
      prefs.hidden = Array.isArray(saved.hidden) ? saved.hidden.filter((k: string) => byKey.has(k) && !byKey.get(k)!.locked) : [];
    }
  } catch {}

  const style = document.createElement('style');
  document.head.append(style);
  const list = document.getElementById('col-list');

  function apply(save = true) {
    const shown = prefs.order.filter((k) => !prefs.hidden.includes(k)).map((k) => byKey.get(k)!);
    const tpl = (f: (c: Column) => string) => shown.map(f).join(' ');
    style.textContent =
      `@media (min-width: 1101px) {` +
      `#list .item, #list .list-head { grid-template-columns: ${tpl((c) => c.w)}; }` +
      prefs.order.map((k, i) => `#list [data-c="${k}"] { order: ${i}; }`).join('') +
      prefs.hidden.map((k) => `#list [data-c="${k}"] { display: none; }`).join('') +
      `}` +
      `@media (min-width: 1101px) and (max-width: 1240px) {` +
      `#list .item, #list .list-head { grid-template-columns: ${tpl((c) => c.narrow)}; }` +
      `}`;
    render();
    if (save) {
      try {
        localStorage.setItem(storeKey, JSON.stringify(prefs));
      } catch {}
    }
  }

  function render() {
    if (!list) return;
    list.innerHTML = prefs.order
      .map((k, i) => {
        const c = byKey.get(k)!;
        const on = !prefs.hidden.includes(k);
        return (
          `<li draggable="true" data-key="${k}">` +
          `<span class="grip" aria-hidden="true">⋮⋮</span>` +
          `<label><input type="checkbox" data-col-toggle="${k}" ${on ? 'checked' : ''} ${c.locked ? 'disabled' : ''}> ${esc(c.label)}</label>` +
          `<button type="button" data-col-move="${k}" data-dir="-1" aria-label="${esc(c.label)}往前" ${i === 0 ? 'disabled' : ''}>↑</button>` +
          `<button type="button" data-col-move="${k}" data-dir="1" aria-label="${esc(c.label)}往後" ${i === prefs.order.length - 1 ? 'disabled' : ''}>↓</button>` +
          `</li>`
        );
      })
      .join('');
  }

  /** 把 key 移到 target 的位置（target 原本那欄往後擠） */
  function move(key: string, target: string) {
    if (key === target) return;
    const order = prefs.order.filter((k) => k !== key);
    order.splice(order.indexOf(target) + (prefs.order.indexOf(key) < prefs.order.indexOf(target) ? 1 : 0), 0, key);
    prefs.order = order;
    apply();
  }

  list?.addEventListener('change', (e) => {
    const k = (e.target as HTMLInputElement).dataset.colToggle;
    if (!k) return;
    prefs.hidden = (e.target as HTMLInputElement).checked ? prefs.hidden.filter((x) => x !== k) : [...prefs.hidden, k];
    apply();
  });
  list?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-col-move]');
    if (!b) return;
    const i = prefs.order.indexOf(b.dataset.colMove!);
    const j = i + Number(b.dataset.dir);
    if (j < 0 || j >= prefs.order.length) return;
    move(b.dataset.colMove!, prefs.order[j]);
    list.querySelector<HTMLButtonElement>(`[data-col-move="${b.dataset.colMove}"][data-dir="${b.dataset.dir}"]:not(:disabled)`)?.focus();
  });
  document.querySelector('[data-cols-reset]')?.addEventListener('click', () => {
    prefs = defaults();
    apply();
  });

  // 拖曳：選單裡的項目和表頭都可以
  let dragging: string | null = null;
  const keyOf = (el: EventTarget | null) => (el as HTMLElement | null)?.closest?.<HTMLElement>('#col-list li, .list-head [data-c]');
  document.addEventListener('dragstart', (e) => {
    const el = keyOf(e.target);
    if (!el) return;
    dragging = el.dataset.key ?? el.dataset.c ?? null;
    e.dataTransfer?.setData('text/plain', dragging ?? '');
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  document.addEventListener('dragover', (e) => {
    const el = keyOf(e.target);
    if (!el || !dragging) return;
    e.preventDefault();
    document.querySelectorAll('.drop-target').forEach((x) => x.classList.remove('drop-target'));
    el.classList.add('drop-target');
  });
  document.addEventListener('drop', (e) => {
    const el = keyOf(e.target);
    if (!el || !dragging) return;
    e.preventDefault();
    move(dragging, (el.dataset.key ?? el.dataset.c)!);
  });
  document.addEventListener('dragend', () => {
    dragging = null;
    document.querySelectorAll('.dragging, .drop-target').forEach((x) => x.classList.remove('dragging', 'drop-target'));
  });

  apply(false);
}
