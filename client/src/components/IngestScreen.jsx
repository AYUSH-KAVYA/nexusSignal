import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  ArrowRight,
  FolderGit2
} from 'lucide-react';

export default function IngestScreen({ onExtractionComplete, demoTranscripts = [], projects = [] }) {
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState('whatsapp');
  const [rawText, setRawText] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const stages = [
    'Establishing project context & open tasks',
    'Generating structured executive summary',
    'Extracting decisions, approvals & action items',
    'Resolving stakeholders & parsing calendar dates',
    'Assembling human review queue'
  ];

  const handleSelectDemo = (demo) => {
    setTitle(demo.title);
    setSourceType(demo.source_type);
    setRawText(demo.raw_text);
    setError(null);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setRawText(content);
        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, ""));
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rawText.trim()) {
      setError('Please provide conversation text or upload a transcript file.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setCurrentStage(0);

    const interval = setInterval(() => {
      setCurrentStage(prev => (prev < 4 ? prev + 1 : prev));
    }, 600);

    try {
      const response = await fetch('/api/conversations/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProjectId,
          source_type: sourceType,
          title: title.trim() || 'Project Conversation',
          raw_text: rawText
        })
      });

      clearInterval(interval);
      setCurrentStage(4);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to process transcript');
      }

      const result = await response.json();
      setTimeout(() => {
        setIsProcessing(false);
        onExtractionComplete(result);
      }, 400);
    } catch (err) {
      clearInterval(interval);
      setIsProcessing(false);
      setError(err.message || 'An error occurred during processing');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Top Header & Sample Selector Directly on Gradient */}
      <div className="space-y-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Capture Project Communication
          </h1>
          <p className="text-xs text-zinc-300 mt-0.5">
            Convert unstructured threads into an executive briefing and verified project tasks.
          </p>
        </div>

        {/* Glassmorphic Sample Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {demoTranscripts.map((demo, idx) => (
            <button
              key={demo.id}
              type="button"
              onClick={() => handleSelectDemo(demo)}
              className="text-left p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 hover:border-white/30 backdrop-blur-md transition-all group shadow-sm hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span>Sample {idx + 1}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-zinc-300 uppercase">
                  {demo.source_type}
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 mt-1 line-clamp-1 group-hover:text-white">
                {demo.title}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Main Ingest Form Card - Soft Matte Dull White (Eye-Comfort) */}
      <form onSubmit={handleSubmit} className="bg-zinc-100/95 backdrop-blur-md rounded-2xl shadow-xl border border-zinc-300/80 p-6 sm:p-7 space-y-5 text-zinc-900">
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* Configuration Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5 text-zinc-500" />
              <span>Project Target</span>
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white/90 px-3.5 py-2.5 text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-black focus:border-black transition-all"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Conversation Title
            </label>
            <input
              type="text"
              placeholder="e.g. Living Room & MEP Sync"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white/90 px-3.5 py-2.5 text-xs text-zinc-900 focus:ring-2 focus:ring-black focus:border-black transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Channel
            </label>
            <div className="grid grid-cols-4 gap-1 bg-zinc-200/80 p-1 rounded-xl border border-zinc-300/80">
              {[
                { id: 'whatsapp', label: 'WhatsApp' },
                { id: 'email', label: 'Email' },
                { id: 'meeting', label: 'Meeting' },
                { id: 'other', label: 'Other' },
              ].map(src => (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => setSourceType(src.id)}
                  className={`py-1.5 text-center rounded-lg text-xs font-medium transition-all ${
                    sourceType === src.id
                      ? 'bg-black text-white font-semibold shadow-xs'
                      : 'text-zinc-700 hover:text-black'
                  }`}
                >
                  {src.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Text Area with Highlighted Blue Upload Button */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
              Conversation Transcript
            </label>

            {/* Prominently Highlighted Blue Upload Button */}
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs hover:shadow-md transition-all hover:-translate-y-0.2">
              <Upload className="w-3.5 h-3.5 text-white" />
              <span>Upload .txt</span>
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="relative">
            <textarea
              rows={9}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste conversation transcript or meeting notes here..."
              className="w-full rounded-xl border border-zinc-300 font-mono text-xs text-zinc-900 p-4 focus:ring-2 focus:ring-black focus:border-black bg-white/90 leading-relaxed transition-all"
            />
            {rawText && (
              <div className="absolute bottom-3 right-3 text-[11px] text-zinc-500 font-mono bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                {rawText.split('\n').filter(Boolean).length} lines • {rawText.length} chars
              </div>
            )}
          </div>
        </div>

        {/* Processing State with Animated Progress */}
        {isProcessing && (
          <div className="bg-black text-white rounded-xl p-4 space-y-3 shadow-inner">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="font-semibold text-white">{stages[currentStage]}...</span>
              </div>
              <span className="text-zinc-400 font-mono text-[11px]">{currentStage + 1} / 5</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-white h-1.5 transition-all duration-300 shadow-sm"
                style={{ width: `${((currentStage + 1) / 5) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => { setRawText(''); setTitle(''); }}
            className="text-xs text-zinc-500 hover:text-zinc-800 font-medium"
          >
            Clear Transcript
          </button>

          <button
            type="submit"
            disabled={isProcessing || !rawText.trim()}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs shadow-sm transition-all ${
              isProcessing || !rawText.trim()
                ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                : 'bg-black hover:bg-zinc-800 text-white hover:-translate-y-0.5 shadow-md'
            }`}
          >
            <span>{isProcessing ? 'Processing...' : 'Summarize & Extract Tasks'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
