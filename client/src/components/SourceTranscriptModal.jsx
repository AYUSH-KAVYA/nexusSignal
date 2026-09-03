import React from 'react';
import { X, Quote, FileText } from 'lucide-react';

export default function SourceTranscriptModal({ isOpen, onClose, conversation, highlightSnippet }) {
  if (!isOpen || !conversation) return null;

  const rawText = conversation.raw_text || '';
  const lines = rawText.split('\n');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-nexus-600" />
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">{conversation.title || 'Source Conversation'}</h3>
              <p className="text-xs text-slate-500 capitalize">Source: {conversation.source_type || 'unspecified'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Highlight Banner if snippet passed */}
        {highlightSnippet && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
            <Quote className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <span className="font-semibold">Selected Reference Snippet: </span>
              <span className="italic">"{highlightSnippet}"</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto font-mono text-xs leading-relaxed space-y-2 bg-slate-900 text-slate-200">
          {lines.map((line, idx) => {
            const isHighlighted = highlightSnippet && line.toLowerCase().includes(highlightSnippet.toLowerCase().trim());
            return (
              <div
                key={idx}
                className={`py-1 px-2 rounded-md transition-colors ${
                  isHighlighted 
                    ? 'bg-amber-500/20 text-amber-200 border-l-4 border-amber-400 font-medium pl-3' 
                    : 'hover:bg-slate-800/60'
                }`}
              >
                <span className="text-slate-500 select-none mr-3 inline-block w-6 text-right">
                  {idx + 1}
                </span>
                <span>{line}</span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
}
