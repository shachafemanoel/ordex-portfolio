import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const ORIGINAL_ENV = { ...process.env };

describe('AI UI gating', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('DeepInsightsPanel shows disabled message when Gemini is off', async () => {
    process.env.NEXT_PUBLIC_GEMINI_ENABLED = 'false';
    const DeepInsightsPanel = (await import('../../components/ai/DeepInsightsPanel')).default;
    render(<DeepInsightsPanel />);
    expect(
      screen.getByText(/תובנות AI לא זמינות/i)
    ).toBeInTheDocument();
    // Button should be disabled
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('AIAssistantPanel blocks actions when Gemini is off', async () => {
    process.env.NEXT_PUBLIC_GEMINI_ENABLED = 'false';
    const { AIAssistantPanel } = await import('../../components/ai/AIAssistantPanel');
    render(<AIAssistantPanel isOpen={true} onClose={() => {}} />);
    expect(
      screen.getByText(/Assistant מושבת/i)
    ).toBeInTheDocument();
    // Inputs should be disabled
    const input = screen.getByPlaceholderText(/חיפוש חופשי/i);
    expect(input).toBeDisabled();
  });
});
