import { prisma } from '@/lib/db';

export class InstallationScheduleService {
  async getTechnicians() {
    try {
      return await (prisma as any).user?.findMany?.({
        where: { role: 'OPERATIONS', isActive: true },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      });
    } catch {
      return [];
    }
  }

  async scheduleInstallation(orderId: string, payload: Record<string, unknown>) {
    return {
      success: false,
      orderId,
      payload,
      message: 'Installation scheduling compatibility shim is active',
    };
  }
}
