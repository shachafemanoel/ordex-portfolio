import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

import { Modal } from '@/components/ui/Modal';

function setupPortal() {
  const existing = document.getElementById('modal-portal-root');
  if (existing) {
    existing.remove();
  }
  const portalRoot = document.createElement('div');
  portalRoot.id = 'modal-portal-root';
  document.body.appendChild(portalRoot);
  return portalRoot;
}

const flushPromises = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('Modal component', () => {
  beforeEach(() => {
    setupPortal();
  });

  afterEach(() => {
    cleanup();
    const portal = document.getElementById('modal-portal-root');
    portal?.remove();
    document.body.innerHTML = '';
  });

  it('focuses the first focusable element when opened', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="כותרת בדיקה">
        <input aria-label="שם" />
      </Modal>
    );

    const dialog = await screen.findByRole('dialog', { name: 'כותרת בדיקה' });
    screen.getByRole('button', { name: 'סגירת חלון' });
    expect(dialog.getAttribute('tabindex')).toBe('-1');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('invokes onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="בדיקת סגירה">
        <button type="button">כפתור</button>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the previously focused trigger when unmounted', async () => {
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    trigger.textContent = 'פתח מודל';
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <Modal isOpen onClose={onClose} title="בדיקת פוקוס חוזר">
        <button type="button">פעולה</button>
      </Modal>
    );

    await screen.findByRole('dialog', { name: 'בדיקת פוקוס חוזר' });

    rerender(
      <Modal isOpen={false} onClose={onClose} title="בדיקת פוקוס חוזר">
        <button type="button">פעולה</button>
      </Modal>
    );

    await flushPromises();
    await flushPromises();
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
    expect(document.body.style.overflow).toBe('');
  });

  it('closes when overlay is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="בדיקת רקע">
        <button type="button">פעולה</button>
      </Modal>
    );

    const dialog = screen.getByRole('dialog', { name: 'בדיקת רקע' });
    const overlay = dialog.parentElement as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });
});
