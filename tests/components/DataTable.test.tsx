import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from '@/components/ui/DataTable';

// Mock Button component since it's used in DataTable
vi.mock('../../components/ui/Button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

// Mock Input component
vi.mock('../../components/ui/Input', () => ({
  Input: (props: any) => <input {...props} />,
}));

// Mock Select component
vi.mock('../../components/ui/Select', () => ({
  Select: (props: any) => <select {...props} />,
}));

describe('DataTable Accessibility', () => {
  const mockData = [
    { id: '1', name: 'Item 1', value: 100 },
    { id: '2', name: 'Item 2', value: 200 },
  ];

  const mockColumns = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'value', title: 'Value', sortable: true },
  ];

  it('renders data correctly', () => {
    render(<DataTable data={mockData} columns={mockColumns} />);
    expect(screen.getByText('Item 1')).toBeDefined();
    expect(screen.getByText('Item 2')).toBeDefined();
  });

  it('handles row click via keyboard (Enter)', () => {
    const onRowClick = vi.fn();
    render(<DataTable data={mockData} columns={mockColumns} onRowClick={onRowClick} />);

    const rows = screen.getAllByRole('row');
    // rows[0] is header, rows[1] is first data row
    const firstRow = rows[1];

    // Check if row is focusable
    expect(firstRow.getAttribute('tabIndex')).toBe('0');

    // Focus and press Enter
    firstRow.focus();
    fireEvent.keyDown(firstRow, { key: 'Enter', code: 'Enter' });

    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('handles row click via keyboard (Space)', () => {
    const onRowClick = vi.fn();
    render(<DataTable data={mockData} columns={mockColumns} onRowClick={onRowClick} />);

    const rows = screen.getAllByRole('row');
    const firstRow = rows[1];

    firstRow.focus();
    fireEvent.keyDown(firstRow, { key: ' ', code: 'Space' });

    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('handles sort header click via keyboard (Enter)', () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        data={mockData}
        columns={mockColumns}
        onSortChange={onSortChange}
        sortable={true}
      />
    );

    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toBeDefined();

    // Check if header is focusable
    expect(nameHeader?.getAttribute('tabIndex')).toBe('0');

    if (nameHeader) {
      nameHeader.focus();
      fireEvent.keyDown(nameHeader, { key: 'Enter', code: 'Enter' });
      expect(onSortChange).toHaveBeenCalledWith('name', expect.any(String));
    }
  });

  it('renders Hebrew ARIA labels for pagination', () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        data={mockData}
        columns={mockColumns}
        pagination={{
          currentPage: 1,
          totalPages: 2,
          pageSize: 10,
          totalItems: 20,
          onPageChange,
        }}
      />
    );

    expect(screen.getByLabelText('עבור לעמוד הבא')).toBeDefined();
    expect(screen.getByLabelText('עבור לעמוד הקודם')).toBeDefined();
    expect(screen.getByLabelText('עבור לעמוד 1')).toBeDefined();
  });
});
