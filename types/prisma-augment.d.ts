// Temporary augmentation to satisfy TypeScript until Prisma client is regenerated
import '@prisma/client';

declare module '@prisma/client' {
  interface PrismaClient {
    calendarEvent: any;
    notificationTemplate: any;
    notificationLog: any;
  }
}
