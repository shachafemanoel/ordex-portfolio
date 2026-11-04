export function scrollToAnchor(hash?: string) {
  if (!hash || typeof document === 'undefined') {
    return;
  }

  const target = document.querySelector(hash);
  if (!target) {
    return;
  }

  target.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });

  if (target instanceof HTMLElement) {
    target.focus({ preventScroll: true });
  }
}
