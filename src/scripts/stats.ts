import { loadMarks, onMarksChange } from './marks';

// 依頁面上的 .item 計算「想吃 / 已排 / 吃過 / 已省」
export function initStats() {
  const box = document.getElementById('my-stats');
  if (!box) return;
  const items = [...document.querySelectorAll<HTMLElement>('.item[data-key]')].map((el) => ({
    key: el.dataset.key!,
    value: Number(el.dataset.value) || 0,
  }));
  const set = (k: string, v: string) => {
    const el = box.querySelector(`[data-stat=${k}]`);
    if (el) el.textContent = v;
  };
  const render = () => {
    const m = loadMarks();
    let want = 0,
      plan = 0,
      done = 0,
      saved = 0;
    for (const it of items) {
      const x = m[it.key];
      if (!x) continue;
      if (x.status === 'want') want++;
      if (x.plan && x.status !== 'done') plan++;
      if (x.status === 'done') {
        done++;
        saved += it.value;
      }
    }
    set('want', String(want));
    set('plan', String(plan));
    set('done', `${done}/${items.length}`);
    set('saved', `$${saved.toLocaleString('zh-TW')}`);
  };
  onMarksChange(render);
  render();
}
