'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function archiveProduct(id: string) {
  try {
    await prisma.product.update({
      where: { id },
      data: {
        is_archived: true,
        isActive: false,
      },
    });
    revalidatePath('/products');
    return { success: true };
  } catch (error) {
    console.error('Failed to archive product:', error);
    return { success: false, error: 'Failed to archive product' };
  }
}

export async function promoteProduct(id: string, isFeatured: boolean) {
  try {
    await prisma.product.update({
      where: { id },
      data: { is_featured: isFeatured },
    });
    revalidatePath('/products');
    return { success: true };
  } catch (error) {
    console.error('Failed to promote product:', error);
    return { success: false, error: 'Failed to promote product' };
  }
}

export async function updateStock(id: string, delta: number) {
  try {
    await prisma.product.update({
      where: { id },
      data: {
        stock: { increment: delta },
      },
    });
    revalidatePath('/products');
    return { success: true };
  } catch (error) {
    console.error('Failed to update stock:', error);
    return { success: false, error: 'Failed to update stock' };
  }
}
