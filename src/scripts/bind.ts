// 把頁面上所有 [data-mark-key] 控制項接到 localStorage
import { getMark, onMarksChange, toggleStatus, updateMark } from './marks';

function sync(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-mark-key]').forEach((box) => {
    const m = getMark(box.dataset.markKey!);
    box.dataset.status = m?.status ?? '';
    box.dataset.planned = m?.plan ? '1' : '';
    box.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach((b) => {
      if (b.dataset.act === 'want' || b.dataset.act === 'done') b.setAttribute('aria-pressed', String(m?.status === b.dataset.act));
    });
    const plan = box.querySelector<HTMLInputElement>('input[data-act=plan]');
    if (plan && document.activeElement !== plan) plan.value = m?.plan ?? '';
    const planLabel = box.querySelector<HTMLElement>('[data-plan-label]');
    if (planLabel) planLabel.textContent = m?.plan ? m.plan.slice(5).replace('-', '/') : '';
    const note = box.querySelector<HTMLTextAreaElement>('textarea[data-act=note]');
    if (note && document.activeElement !== note) note.value = m?.note ?? '';
  });
}

export function initMarkControls() {
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
    const box = b?.closest<HTMLElement>('[data-mark-key]');
    if (!b || !box) return;
    const key = box.dataset.markKey!;
    if (b.dataset.act === 'want' || b.dataset.act === 'done') toggleStatus(key, b.dataset.act);
  });
  document.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement;
    const box = el.closest<HTMLElement>('[data-mark-key]');
    if (!box) return;
    if (el.dataset.act === 'plan') updateMark(box.dataset.markKey!, { plan: el.value });
    if (el.dataset.act === 'note') updateMark(box.dataset.markKey!, { note: el.value.trim() });
  });
  onMarksChange(() => sync());
  sync();
}
