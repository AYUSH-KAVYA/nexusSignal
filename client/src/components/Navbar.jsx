import React from 'react';

export default function Navbar({ activeTab, setActiveTab, pendingCount }) {
  const tabs = [
    { id: 'ingest', label: 'Capture' },
    { 
      id: 'review', 
      label: 'Review', 
      badge: pendingCount > 0 ? pendingCount : null 
    },
    { id: 'memory', label: 'Memory' },
    { id: 'tasks', label: 'Tasks' }
  ];

  return (
    <header className="bg-black/60 backdrop-blur-md border-b border-white/10 sticky top-0 z-30 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand - Text Only */}
          <div className="flex items-center">
            <span className="font-bold text-base text-white tracking-tight">
              Nexus Signal
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
                    isActive
                      ? 'bg-white text-black font-semibold shadow-xs'
                      : 'text-zinc-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-200 border border-zinc-700">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
