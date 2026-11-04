import { prisma } from '@/lib/db';

export interface ImportRecord {
  externalId: string;
  data: Record<string, any>;
}

export class EcommerceImporter {
  async processJob(jobId: string) {
    const job = await prisma.dataImportJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    await prisma.dataImportJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING' }
    });

    try {
      // Mock data fetching logic based on source
      // const records = await this.fetchFromSource(job.source);
      const records: ImportRecord[] = [];

      await prisma.dataImportJob.update({
        where: { id: jobId },
        data: { totalItems: records.length }
      });

      let processed = 0;
      const errors: any[] = [];

      for (const record of records) {
        try {
          // Implement mapping and saving logic here
          // const order = await prisma.order.create(...)
          processed++;
        } catch (e) {
          errors.push({ id: record.externalId, error: String(e) });
        }
      }

      await prisma.dataImportJob.update({
        where: { id: jobId },
        data: {
          status: errors.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
          processed,
          errors: errors.length > 0 ? errors : undefined
        }
      });

    } catch (error) {
       await prisma.dataImportJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', errors: { message: String(error) } }
      });
    }
  }
}

export const ecommerceImporter = new EcommerceImporter();
