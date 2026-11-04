import {
  CustomerDetailsView,
  type CustomerDetailsData,
} from '@/components/customers/CustomerDetailsView';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { z } from 'zod';

const CustomerSchema: z.ZodType<CustomerDetailsData, z.ZodTypeDef, unknown> = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  segment: z.string().nullable().optional(),
  lifecycle: z.string(),
  riskLevel: z.string(),
  currentBalanceCents: z.number().nullable().optional().default(0),
  lastActivityAt: z.date().nullable().optional(),
  accountNotes: z.string().nullable().optional(),
  accountManagerId: z.string().nullable().optional(),
  addresses: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        city: z.string(),
        street: z.string(),
        number: z.string(),
        floor: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .default([]),
  orders: z
    .array(
      z.object({
        id: z.string(),
        number: z.string(),
        status: z.string(),
        totalCents: z.number().nullable().optional().default(0),
        createdAt: z.date(),
      })
    )
    .default([]),
});

export default async function CustomerDetailsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      addresses: true,
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          number: true,
          status: true,
          totalCents: true,
          createdAt: true,
        },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  const parsedCustomer = CustomerSchema.safeParse(customer);

  if (!parsedCustomer.success) {
    console.error('Invalid customer payload', parsedCustomer.error.format());
    throw new Error('Invalid customer payload');
  }

  return <CustomerDetailsView customer={parsedCustomer.data} />;
}
