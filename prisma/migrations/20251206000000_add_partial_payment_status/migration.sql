-- Add PARTIAL payment status for partially paid orders
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';
