import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/management/overview/route';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { UserRole } from '@prisma/client';
import type { ManagementOverviewData } from '@/services/managementOverviewService';

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const managementOverviewMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth/verifySession', () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock('@/services/managementOverviewService', () => ({
  getManagementOverviewData: managementOverviewMock,
}));

const sampleOverview: ManagementOverviewData = {
  stats: {
    customers: {
      total: 5,
      newThisMonth: 2,
      activeThisMonth: 3,
      recent: [],
      topByValue: [],
    },
    orders: {
      total: 10,
      revenue: 5000,
      avgValue: 500,
      statusBreakdown: [],
      trend: [],
    },
    products: {
      totalSkus: 12,
      lowStock: [],
      topSelling: [],
    },
    team: {
      totalUsers: 4,
      roles: [],
      topPerformers: [],
    },
  },
};

function buildRequest() {
  return new NextRequest('http://localhost/api/management/overview');
}

function buildUser(role: UserRole): AuthenticatedUser {
  return {
    id: `${role.toLowerCase()}-user`,
    email: `${role.toLowerCase()}@ordex.local`,
    name: `${role} User`,
    role,
    permissions: [],
  };
}

describe('Auth E2E', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    managementOverviewMock.mockReset();
    managementOverviewMock.mockResolvedValue(sampleOverview);
  });

  it('should return 401 for a protected route when not logged in', async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await GET(buildRequest());
    expect(res.status).toBe(401);
  });

  it('should return 200 for a protected route when logged in as admin', async () => {
    getCurrentUserMock.mockResolvedValue(buildUser(UserRole.MANAGER));
    const res = await GET(buildRequest());
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);
    expect(managementOverviewMock).toHaveBeenCalled();
  });

  it('should return 403 for a protected route when logged in as a regular user', async () => {
    getCurrentUserMock.mockResolvedValue(buildUser(UserRole.OPERATIONS_WORKER));
    const res = await GET(buildRequest());
    expect(res.status).toBe(403);
  });
});
