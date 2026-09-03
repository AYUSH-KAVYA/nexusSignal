import React, { useState } from 'react';
import { 
  User, 
  ExternalLink, 
  Quote
} from 'lucide-react';

export default function TasksScreen({ tasks = [], onSelectConversation }) {
  const [filter, setFilter] = useState('all');

  const filteredTasks = tasks.filter(t => {
    if (filter === 'from_conversation' && !t.source_conversation_id) return false;
    if (filter === 'pending' && t.status !== 'pending') return false;
    if (filter === 'done' && t.status !== 'done') return false;
    return true;
  });

  const fromConvCount = tasks.filter(t => t.source_conversation_id).length;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'done':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-200/80 text-zinc-900 border border-zinc-300">Done</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-200/80 text-zinc-900 border border-zinc-300">In Progress</span>;
      case 'blocked':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-200/80 text-zinc-900 border border-zinc-300">Blocked</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-200/80 text-zinc-900 border border-zinc-300">Pending</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header directly on gradient */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/15">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">Project Tasks</h1>
          <p className="text-xs text-zinc-300 mt-0.5">
            Tasks converted from project communication threads.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md p-1 rounded-xl border border-white/20 shadow-md">
          {[
            { id: 'all', label: `All (${tasks.length})` },
            { id: 'from_conversation', label: `From Chat (${fromConvCount})` },
            { id: 'pending', label: 'Pending' },
            { id: 'done', label: 'Done' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f.id
                  ? 'bg-white text-black font-semibold shadow-xs'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task Cards - Soft Dull White */}
      <div className="space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50/90 backdrop-blur-md rounded-2xl border border-zinc-300/70 text-zinc-500 text-xs shadow-md">
            No tasks match this filter.
          </div>
        ) : (
          filteredTasks.map(task => {
            const isFromConversation = !!task.source_conversation_id;

            return (
              <div
                key={task.id}
                className="bg-zinc-50/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-zinc-300/80 shadow-sm hover:shadow-md hover:border-zinc-400 transition-all space-y-2 text-zinc-900"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {getStatusBadge(task.status)}

                      {isFromConversation && (
                        <button
                          onClick={() => onSelectConversation(task.source_conversation_id)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-700 hover:text-black transition-colors"
                        >
                          <span>From: {task.conversation_title || 'Conversation'}</span>
                          <ExternalLink className="w-3 h-3 text-zinc-400" />
                        </button>
                      )}

                      {task.owner_name && (
                        <span className="text-zinc-600 text-[11px] flex items-center gap-1">
                          <User className="w-3 h-3 text-zinc-400" />
                          {task.owner_name}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xs sm:text-sm font-semibold text-zinc-900">
                      {task.title}
                    </h3>

                    {task.description && (
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {task.source_snippet && (
                      <div className="mt-1.5 text-xs bg-zinc-100/90 border border-zinc-200 rounded-lg p-2.5 flex items-start gap-1.5 text-zinc-600">
                        <Quote className="w-3 h-3 text-zinc-400 shrink-0 mt-0.5" />
                        <span className="italic">"{task.source_snippet}"</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
