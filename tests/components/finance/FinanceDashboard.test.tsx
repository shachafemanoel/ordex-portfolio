import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FinanceDashboard } from '@/components/finance/FinanceDashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

describe('FinanceDashboard', () => {
  it('renders empty state when there are no recent payments', () => {
    render(
      <FinanceDashboard
        data={{
          kpis: {
            revenue: { value: 0, trend: 0 },
            openInvoices: { count: 0, amount: 0 },
            expenses: { value: 0 },
            netProfit: { value: 0, margin: 0 },
          },
          recentPayments: [],
        }}
      />
    );

    expect(screen.getByText('אין תנועות אחרונות')).toBeInTheDocument();
  });
});
