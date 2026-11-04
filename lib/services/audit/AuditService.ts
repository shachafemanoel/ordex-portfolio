export class AuditService {
    logCreate(entity: string, id: string, userId: string, data: any) {
        //
    }

    logUpdate(entity: string, id: string, userId: string, before: any, after: any, reason?: string) {
        //
    }

    logOrderStatusChange(orderId: string, from: any, to: any, userId: string, reason?: string) {
        //
    }    logDelete(entity: string, id: string, userId: string) {
        //
    }
}
