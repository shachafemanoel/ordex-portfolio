import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { InlineEditField } from '@/components/ui/InlineEditField';

describe('InlineEditField', () => {
  afterEach(() => {
    cleanup();
  });

  it('restores focus to the edit button after saving', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<InlineEditField label="Test Field" value="Initial Value" onSave={onSave} />);

    // Start editing
    const editButton = screen.getByRole('button', { name: /Test Field/ });
    editButton.focus();
    fireEvent.click(editButton);

    // Change value
    const input = screen.getByDisplayValue('Initial Value');
    fireEvent.change(input, { target: { value: 'New Value' } });

    // Save
    const saveButton = screen.getByRole('button', { name: 'שמור' });
    fireEvent.click(saveButton);

    // Wait for save to complete and button to reappear
    await waitFor(() => {
      expect(screen.queryByDisplayValue('New Value')).toBeNull(); // Edit mode closed
    });

    // Check focus is back on the edit button
    // Note: We need to wait for the button to be in the DOM and focused
    const restoredButton = await screen.findByRole('button', { name: /Test Field/ });
    await waitFor(() => {
        expect(document.activeElement).toBe(restoredButton);
    });
  });

  it('restores focus to the edit button after cancelling', async () => {
    const onSave = vi.fn();
    render(<InlineEditField label="Test Field" value="Initial Value" onSave={onSave} />);

    // Start editing
    const editButton = screen.getByRole('button', { name: /Test Field/ });
    editButton.focus(); // Ensure it was focused before
    fireEvent.click(editButton);

    // Cancel
    const cancelButton = screen.getByRole('button', { name: 'ביטול' });
    fireEvent.click(cancelButton);

    // Check focus is back on the edit button
    const restoredButton = await screen.findByRole('button', { name: /Test Field/ });
    await waitFor(() => {
        expect(document.activeElement).toBe(restoredButton);
    });
  });
});
