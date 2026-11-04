import { PrismaLabelRepository } from '@/lib/repositories/implementations/PrismaLabelRepository';
import { OrderStatus } from '@prisma/client';

export class LabelService {
  private repository: PrismaLabelRepository;

  constructor() {
    this.repository = new PrismaLabelRepository();
  }

  async getAllLabels() {
    return this.repository.findAll();
  }

  async getLabelById(id: string) {
    return this.repository.findById(id);
  }

  async getLabelsByStage(stage: OrderStatus) {
    return this.repository.findByStage(stage);
  }

  async createLabel(data: { name: string; color?: string; stage?: OrderStatus }) {
    return this.repository.create(data);
  }

  async updateLabel(id: string, data: { name?: string; color?: string; stage?: OrderStatus }) {
    return this.repository.update(id, data);
  }

  async deleteLabel(id: string) {
    return this.repository.delete(id);
  }

  async assignLabelToOrder(orderId: string, labelId: string) {
    return this.repository.assignToOrder(orderId, labelId);
  }

  async unassignLabelFromOrder(orderId: string, labelId: string) {
    return this.repository.unassignFromOrder(orderId, labelId);
  }

  async setOrderLabels(orderId: string, labelIds: string[]) {
    return this.repository.setOrderLabels(orderId, labelIds);
  }
}
