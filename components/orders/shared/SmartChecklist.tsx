'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface SmartChecklistTask {
  id: string;
  label: string;
  completed: boolean;
}

interface SmartChecklistProps {
  tasks: SmartChecklistTask[];
  onToggle: (id: string) => void;
}

export function SmartChecklist({ tasks, onToggle }: SmartChecklistProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    tasks.find((task) => !task.completed)?.id ?? null
  );

  return (
    <div className="space-y-3" dir="rtl">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
        >
          <div
            className={`flex cursor-pointer items-center justify-between p-4 ${task.completed ? 'bg-slate-50' : 'bg-white'}`}
            onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggle(task.id);
                }}
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                  task.completed
                    ? 'border-emerald-500 bg-emerald-500 text-on-dark'
                    : 'border-slate-300 hover:border-blue-500'
                }`}
              >
                {task.completed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
              </button>

              <span
                className={`text-sm font-medium ${
                  task.completed ? 'text-slate-400 line-through' : 'text-slate-900'
                }`}
              >
                {task.label}
              </span>
            </div>

            {expandedId === task.id ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </div>

          <AnimatePresence>
            {expandedId === task.id ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-slate-100 px-4 pb-4 pt-3"
              >
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                  {task.completed
                    ? 'משימה זו הושלמה.'
                    : 'ניתן להוסיף כאן הנחיות קצרות לביצוע המשימה.'}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
