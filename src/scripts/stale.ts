// 「可能過期」要在瀏覽器依今天日期判斷，不然網站一年沒重新 build 就永遠不會提示
import { isStale } from '../lib/shared';

export function markStale(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-updated]').forEach((el) => {
    const stale = isStale(el.dataset.updated);
    el.toggleAttribute('data-stale', stale);
    el.querySelectorAll<HTMLElement>('[data-stale-show]').forEach((x) => (x.hidden = !stale));
  });
}
