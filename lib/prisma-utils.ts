import { Prisma } from '@prisma/client';
import { sleep } from '@/utils/sleep';

// Define a list of transient error codes that can be retried
const RETRYABLE_ERROR_CODES = [
  'P1001', // Can't reach database server
  'P1008', // Operations timed out
  'P2024', // A new transaction is required for this operation
];

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

type PrismaFunction<T> = () => Promise<T>;

/**
 * Wraps a Prisma query with a retry mechanism to handle transient database errors.
 *
 * @param fn The Prisma function to execute (e.g., () => prisma.user.findMany())
 * @returns The result of the Prisma function
 * @throws {Error} Throws the original Prisma error if retries are exhausted
 */
export async function withRetry<T>(fn: PrismaFunction<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && RETRYABLE_ERROR_CODES.includes(e.code)) {
        console.warn(
          `Prisma query failed (attempt ${attempt}/${MAX_RETRIES}) with code ${e.code}. Retrying in ${RETRY_DELAY_MS}ms...`
        );
        if (attempt === MAX_RETRIES) {
          console.error(`Prisma query failed after ${MAX_RETRIES} attempts.`, e);
          throw e; // Rethrow the error after the final attempt
        }
        await sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
      } else {
        // Non-retryable error, rethrow immediately
        throw e;
      }
    }
  }
  // This line should be unreachable, but it's here for type safety
  throw new Error('Exited retry loop unexpectedly.');
}
