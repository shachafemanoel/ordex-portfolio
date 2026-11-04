import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { VirtualDataTable, Column } from '@/components/ui/VirtualDataTable';

// Mock ResizeObserver for VirtualDataTable
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

interface TestItem {
  id: string;
  name: string;
  value: number;
}

const data: TestItem[] = Array.from({ length: 100 }, (_, i) => ({
  id: `id-${i}`,
  name: `Item ${i}`,
  value: i * 10,
}));

const columns: Column<TestItem>[] = [
  { key: 'id', header: 'ID', width: 100 },
  { key: 'name', header: 'Name', width: 200 },
  { key: 'value', header: 'Value', width: 100 },
];

describe('VirtualDataTable', () => {
  it('renders correctly', () => {
    render(
      <VirtualDataTable
        data={data}
        columns={columns}
        containerHeight={500}
        rowHeight={50}
      />
    );

    // getByText throws if not found, so if these pass, the elements are there.
    expect(screen.getByText('Item 0')).toBeDefined();
    expect(screen.getByText('Item 5')).toBeDefined();
  });

  it('handles row selection', () => {
    const onSelect = vi.fn();
    render(
      <VirtualDataTable
        data={data}
        columns={columns}
        selectable
        onSelect={onSelect}
        selectedIds={new Set()}
        getRowId={(item) => item.id}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is "select all" in header
    // Second checkbox is first row
    fireEvent.click(checkboxes[1]);

    expect(onSelect).toHaveBeenCalledWith('id-0', true);
  });
});
