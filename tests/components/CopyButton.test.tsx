import { CopyButton } from '@/components/ui/CopyButton';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock clipboard
const writeTextMock = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: writeTextMock,
  },
});

describe('CopyButton', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders correctly with default label', () => {
    render(
      <TooltipProvider>
        <CopyButton text="test-text" />
      </TooltipProvider>
    );
    const button = screen.getByRole('button', { name: /העתק/i });
    expect(button).toBeDefined();
  });

  it('copies text to clipboard and updates visual state', async () => {
    // const user = userEvent.setup();
    render(
      <TooltipProvider>
        <CopyButton text="copy-me" />
      </TooltipProvider>
    );

    const button = screen.getByRole('button', { name: /העתק/i });

    // Use fireEvent to simplify event dispatching in this environment
    // await user.click(button);
    fireEvent.click(button);

    expect(writeTextMock).toHaveBeenCalledWith('copy-me');

    // Check for "Copied!" state (aria-label update)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /הועתק!/i })).toBeDefined();
    });
  });
});
