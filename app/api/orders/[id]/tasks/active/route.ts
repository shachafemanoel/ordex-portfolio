export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getActiveTask, ensureActiveTask } from '@/lib/tasks/orderTaskService';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    let activeTask = await getActiveTask(id);
    if (!activeTask) {
      activeTask = await ensureActiveTask(id);
    }

    if (!activeTask) {
      return NextResponse.json({ success: false, error: 'No active task found' }, { status: 404 });
    }

    // Determine Now/Later bucket
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    
    const isLater = activeTask.dueAt && activeTask.dueAt > now;
    const bucket = isLater ? 'LATER' : 'NOW';

    return NextResponse.json({
      success: true,
      activeTask,
      bucket,
    });
  } catch (error: any) {
    console.error('Error fetching active task:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
