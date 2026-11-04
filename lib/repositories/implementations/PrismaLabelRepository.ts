import { prisma } from '@/lib/db';
import { OrderStatus, Prisma } from '@prisma/client';

function extractMissingTable(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const meta = error.meta as Record<string, unknown> | undefined;
  const table = meta?.table;
  return typeof table === 'string' ? table : undefined;
}

export function isLabelsTableMissingError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2021') return false;
  const table = extractMissingTable(error);
  const raw = `${table ?? ''} ${error.message}`.toLowerCase();
  return raw.includes('label');
}

export class LabelsFeatureUnavailableError extends Error {
  constructor() {
    super('Labels feature is unavailable until label migrations are applied');
    this.name = 'LabelsFeatureUnavailableError';
  }
}

export class PrismaLabelRepository {
  async findAll() {
    try {
      return await prisma.label.findMany({
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      if (isLabelsTableMissingError(error)) {
        return [];
      }
      throw error;
    }
  }

  async findById(id: string) {
    try {
      return await prisma.label.findUnique({
        where: { id },
      });
    } catch (error) {
      if (isLabelsTableMissingError(error)) {
        return null;
      }
      throw error;
    }
  }

  async findByStage(stage: OrderStatus) {
    try {
      return await prisma.label.findMany({
        where: { stage },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      if (isLabelsTableMissingError(error)) {
        return [];
      }
      throw error;
    }
  }

  async create(data: { name: string; color?: string; stage?: OrderStatus }) {
    try {
      return await prisma.label.create({
        data,
      });
    } catch (error) {
      if (isLabelsTableMissingError(error)) {
        throw new LabelsFeatureUnavailableError();
      }
      throw error;
    }
  }

  async update(id: string, data: { name?: string; color?: string; stage?: OrderStatus }) {
    try {
      return await prisma.label.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (isLabelsTableMissingError(error)) {
        throw new LabelsFeatureUnavailableError();
      }
      throw error;
    }
  }

  async delete(id: string) {
    try {
      return await prisma.label.delete({
        where: { id },
      });
    } catch (error) {
      if (isLabelsTableMissingError(error)) {
        throw new LabelsFeatureUnavailableError();
      }
      throw error;
    }
  }

  private async getOrderFallback(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        status: true,
      },
    });
    if (!order) return null;
    return { ...order, labels: [] };
  }

  async assignToOrder(orderId: string, labelId: string) {
    try {
      return await prisma.order.update({
        where: { id: orderId },
        data: {
          labels: {
            connect: { id: labelId },
          },
        },
        include: { labels: true },
      });
    } catch (error) {
      if (isLabelsTableMissingError(error)) {
        return this.getOrderFallback(orderId);
      }
      throw error;
    }
  }

  async unassignFromOrder(orderId: string, labelId: string) {
    try {
      return await prisma.order.update({
        where: { id: orderId },
        data: {
          labels: {
            disconnect: { id: labelId },
          },
        },
        include: { labels: true },
      });
    } catch (error) {
      if (isLabelsTableMissingError(error)) {
        return this.getOrderFallback(orderId);
      }
      throw error;
    }
  }

  async setOrderLabels(orderId: string, labelIds: string[]) {
    try {
      return await prisma.order.update({
        where: { id: orderId },
        data: {
          labels: {
            set: labelIds.map((id) => ({ id })),
          },
        },
        include: { labels: true },
      });
    } catch (error) {
      if (isLabelsTableMissingError(error)) {
        return this.getOrderFallback(orderId);
      }
      throw error;
    }
  }
}
