import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { vi, describe, it, expect } from 'vitest';

// Mock apiClient with one notification to test NotificationItem
vi.mock('@/lib/apiClient', () => ({
  default: vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      data: [{
        id: '1',
        severity: 'info',
        title: 'Test Notification',
        message: 'Test message',
        timestamp: new Date().toISOString(),
        read: false,
        category: 'TEST'
      }]
    }),
  })),
}));

// Mock Notification API
global.Notification = {
  requestPermission: vi.fn(),
  permission: 'default',
} as any;

describe('NotificationCenter Accessibility', () => {
  it('renders buttons with correct ARIA labels', async () => {
    render(<NotificationCenter />);

    // Find the toggle button
    const toggleButton = screen.getByLabelText(/מרכז התראות/i);
    expect(toggleButton).toBeDefined();

    // Click to open
    fireEvent.click(toggleButton);

    // Wait for panel to appear (findBy queries wait automatically)

    // 1. Permission button
    const permissionButton = await screen.findByLabelText(/אפשר התראות דסקטופ/i);
    expect(permissionButton).toBeDefined();
    expect(permissionButton.getAttribute('title')).toBe('אפשר התראות דסקטופ');

    // 2. Refresh button
    const refreshButton = screen.getByLabelText(/רענן התראות/i);
    expect(refreshButton).toBeDefined();
    expect(refreshButton.getAttribute('title')).toBe('רענן התראות');

    // 3. Dismiss button (inside NotificationItem)
    const dismissButton = await screen.findByLabelText(/הסר התראה/i);
    expect(dismissButton).toBeDefined();
    expect(dismissButton.getAttribute('title')).toBe('הסר התראה');
  });
});
