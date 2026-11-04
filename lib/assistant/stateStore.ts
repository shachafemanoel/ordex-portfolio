import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getRedisClient, isRedisReady } from '@/lib/redis';
import { Prisma } from '@prisma/client';

export interface AssistantState {
  contextKey: string;
  lastActionId?: string | null;
  lastFilters?: Record<string, any> | null;
  selectedOrderIds?: string[] | null;
  lastReportType?: string | null;
  geminiCacheId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const REDIS_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
const redisKey = (contextKey: string) => `assistant:state:${contextKey}`;

function toAssistantState(data: any, contextKey: string): AssistantState {
  if (!data) {
    return {
      contextKey,
      selectedOrderIds: [],
      lastFilters: {},
    };
  }

  return {
    contextKey,
    lastActionId: data.lastActionId ?? data.last_action_id ?? data.last_actionId ?? null,
    lastFilters: data.lastFilters ?? data.last_filters ?? null,
    selectedOrderIds: data.selectedOrderIds ?? data.selected_order_ids ?? null,
    lastReportType: data.lastReportType ?? data.last_report_type ?? null,
    geminiCacheId: data.geminiCacheId ?? data.gemini_cache_id ?? null,
    createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
  };
}

async function readFromRedis(contextKey: string): Promise<AssistantState | null> {
  if (!isRedisReady()) return null;
  try {
    const client = await getRedisClient();
    if (!client) return null;
    const raw = await client.get(redisKey(contextKey));
    return raw ? toAssistantState(JSON.parse(raw), contextKey) : null;
  } catch (error) {
    logger.warn('Assistant state redis read failed', { error });
    return null;
  }
}

async function writeToRedis(state: AssistantState): Promise<void> {
  if (!isRedisReady()) return;
  try {
    const client = await getRedisClient();
    if (!client) return;
    await client.set(redisKey(state.contextKey), JSON.stringify(state), {
      EX: REDIS_TTL_SECONDS,
    });
  } catch (error) {
    logger.warn('Assistant state redis write failed', { error });
  }
}

async function readFromPrisma(contextKey: string): Promise<AssistantState | null> {
  try {
    const record = await prisma.assistantState.findUnique({
      where: { contextKey },
    });
    if (!record) return null;
    return toAssistantState(record, contextKey);
  } catch (error: any) {
    // If the table is missing (migration not applied), fall back gracefully
    if (error?.code === 'P2021' || error?.message?.includes('assistant_states')) {
      logger.warn('Assistant state table missing; falling back to default state');
      return null;
    }
    logger.warn('Assistant state prisma read failed', { error });
    return null;
  }
}

async function writeToPrisma(state: AssistantState): Promise<void> {
  try {
    await prisma.assistantState.upsert({
      where: { contextKey: state.contextKey },
      create: {
        contextKey: state.contextKey,
        lastActionId: state.lastActionId ?? null,
        lastFilters: state.lastFilters ?? Prisma.DbNull,
        selectedOrderIds: state.selectedOrderIds ?? Prisma.DbNull,
        lastReportType: state.lastReportType ?? null,
        geminiCacheId: state.geminiCacheId ?? null,
      },
      update: {
        lastActionId: state.lastActionId ?? null,
        lastFilters: state.lastFilters ?? Prisma.DbNull,
        selectedOrderIds: state.selectedOrderIds ?? Prisma.DbNull,
        lastReportType: state.lastReportType ?? null,
        geminiCacheId: state.geminiCacheId ?? null,
      },
    });
  } catch (error: any) {
    if (error?.code === 'P2021' || error?.message?.includes('assistant_states')) {
      logger.warn('Assistant state table missing; skipping persistence');
      return;
    }
    logger.warn('Assistant state prisma write failed', { error });
  }
}

export async function getAssistantState(contextKey: string): Promise<AssistantState> {
  const redisState = await readFromRedis(contextKey);
  if (redisState) return redisState;

  const dbState = await readFromPrisma(contextKey);
  if (dbState) {
    await writeToRedis(dbState);
    return dbState;
  }

  return toAssistantState(null, contextKey);
}

export async function patchAssistantState(
  contextKey: string,
  patch: Partial<AssistantState>
): Promise<AssistantState> {
  const current = await getAssistantState(contextKey);
  const merged: AssistantState = {
    ...current,
    ...patch,
    contextKey,
    updatedAt: new Date(),
  };

  await Promise.all([writeToRedis(merged), writeToPrisma(merged)]);
  return merged;
}
