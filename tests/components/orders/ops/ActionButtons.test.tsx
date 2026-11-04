import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ActionButtons } from '@/components/orders/ops/components/ActionButtons';
describe('MVP action buttons',()=>{
 it('offers scheduling and item readiness',()=>{
  render(<ActionButtons onSelectForm={vi.fn()} />);
  expect(screen.getByRole('button',{name:/קביעת מועד אספקה/})).toBeVisible();
  expect(screen.getByRole('button',{name:/סטטוס פריטים/})).toBeVisible();
  expect(screen.queryByText('העברה לרכש')).not.toBeInTheDocument();
 });
 it('selects the corresponding form with a keyboard-accessible button',()=>{
  const select=vi.fn();render(<ActionButtons onSelectForm={select} />);
  fireEvent.click(screen.getByRole('button',{name:/קביעת מועד אספקה/}));expect(select).toHaveBeenLastCalledWith('schedule');
  fireEvent.click(screen.getByRole('button',{name:/סטטוס פריטים/}));expect(select).toHaveBeenLastCalledWith('ready');
 });
});
