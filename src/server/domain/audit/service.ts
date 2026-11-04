import prisma from "@/lib/prisma";

export async function logEvent(
  orderId: string,
  action: string,
  actorId: string | null,
  payload: any,
  meta?: any,
  diff?: any
) {
  return prisma.auditEvent.create({
    data: {
      orderId,
      action,
      actorId,
      payload,
      meta,
      diff,
    },
  });
}
