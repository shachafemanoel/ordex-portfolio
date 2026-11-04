export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { upsertChecklistState, logTaskEvent } from '@/lib/tasks/orderTaskService';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { patches, note, taskId } = body;

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'taskId is required' }, { status: 400 });
    }

    const updatedTask = await upsertChecklistState(taskId, patches);

    if (note) {
      await logTaskEvent(id, taskId, 'TASK_CHANGED', {
        message: `הערת משימה עודכנה: ${note}`,
      });
    }

    return NextResponse.json({
      success: true,
      task: updatedTask,
    });
  } catch (error: any) {
    console.error('Error updating checklist:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
