import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { FinanceDashboard } from '@/components/finance/FinanceDashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('FinanceDashboard', () => {
  it('renders an error empty state when no data is available', () => {
    render(<FinanceDashboard data={null} error="טעינת הדשבורד נכשלה." />);

    expect(screen.getByText('טעינת הדשבורד נכשלה')).toBeInTheDocument();
    expect(screen.getByText('נסה שוב')).toBeInTheDocument();
  });

  it('renders an empty state when there are no recent payments', () => {
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
    expect(screen.getByText('לא נרשמו תשלומים לאחרונה.')).toBeInTheDocument();
  });
});
