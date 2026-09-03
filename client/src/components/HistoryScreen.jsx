import React, { useState } from 'react';
import { 
  Search, 
  Trash2, 
  ArrowRight
} from 'lucide-react';

export default function HistoryScreen({ 
  conversations = [], 
  searchQuery, 
  setSearchQuery, 
  onSelectConversation, 
  onDeleteConversation,
  isLoading 
}) {
  const [selectedSource, setSelectedSource] = useState('all');

  const filtered = conversations.filter(c => {
    if (selectedSource !== 'all' && c.source_type !== selectedSource) return false;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Clean Search Bar directly on gradient */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-center">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search conversations, decisions, keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-300/80 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-black bg-zinc-50/95 backdrop-blur-md placeholder-zinc-400 shadow-md text-zinc-900 transition-all"
          />
        </div>

        <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md p-1 rounded-xl border border-white/20 self-stretch sm:self-auto justify-center shadow-md">
          {[
            { id: 'all', label: 'All' },
            { id: 'whatsapp', label: 'WhatsApp' },
            { id: 'email', label: 'Email' },
            { id: 'meeting', label: 'Meeting' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedSource(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedSource === tab.id
                  ? 'bg-black text-white font-semibold shadow-xs'
                  : 'text-zinc-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations List with Rich Hover CSS & Eye-Friendly Matte Styling */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-zinc-300 text-xs">
            Searching...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center bg-zinc-100/90 backdrop-blur-md rounded-2xl border border-zinc-300/70 text-zinc-500 text-xs shadow-md">
            No conversations found.
          </div>
        ) : (
          filtered.map(conv => (
            <div
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className="bg-zinc-50/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-zinc-300/70 shadow-sm hover:shadow-xl hover:border-zinc-500 hover:-translate-y-1 transition-all duration-200 cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-zinc-900"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <span className="font-semibold uppercase tracking-wider text-zinc-800 bg-zinc-200/80 px-2 py-0.5 rounded-md group-hover:bg-zinc-300 transition-colors">
                    {conv.source_type}
                  </span>
                  <span>•</span>
                  <span>{new Date(conv.created_at).toLocaleDateString()}</span>
                  <span>•</span>
                  <span className="text-zinc-700 font-medium">{conv.total_items} items extracted</span>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-zinc-900 group-hover:text-black transition-colors">
                  {conv.title}
                </h3>

                <p className="text-xs text-zinc-600 line-clamp-1 font-mono bg-white/70 p-2 rounded-lg border border-zinc-200/70 group-hover:border-zinc-300 transition-colors">
                  {conv.raw_text}
                </p>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }}
                  className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="p-2 rounded-xl bg-zinc-200/60 text-zinc-600 group-hover:bg-black group-hover:text-white group-hover:translate-x-1 transition-all duration-200 shadow-2xs">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
