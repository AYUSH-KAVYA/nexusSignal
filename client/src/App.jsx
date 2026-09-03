import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import IngestScreen from './components/IngestScreen';
import ReviewScreen from './components/ReviewScreen';
import HistoryScreen from './components/HistoryScreen';
import TasksScreen from './components/TasksScreen';
import SourceTranscriptModal from './components/SourceTranscriptModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('ingest');
  const [projects, setProjects] = useState([]);
  const [stakeholders, setStakeholders] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [demoTranscripts, setDemoTranscripts] = useState([]);
  const [engineStatus, setEngineStatus] = useState(null);

  // Active conversation being reviewed
  const [activeConversation, setActiveConversation] = useState(null);
  const [activeItems, setActiveItems] = useState([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Transcript Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalHighlight, setModalHighlight] = useState(null);

  // Initial data loading
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      // 1. Projects
      const pRes = await fetch('/api/projects');
      const pData = await pRes.json();
      setProjects(pData);

      const targetProjectId = pData[0]?.id;

      if (targetProjectId) {
        // 2. Stakeholders
        const sRes = await fetch(`/api/projects/${targetProjectId}/stakeholders`);
        setStakeholders(await sRes.json());

        // 3. Tasks
        const tRes = await fetch(`/api/projects/${targetProjectId}/tasks`);
        setTasks(await tRes.json());
      }

      // 4. Demo transcripts
      const dRes = await fetch('/api/demo/transcripts');
      setDemoTranscripts(await dRes.json());

      // 5. Engine status
      const stRes = await fetch('/api/demo/status');
      setEngineStatus(await stRes.json());

      // 6. Conversations list
      fetchConversations();
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  };

  const fetchConversations = async (q = '') => {
    setIsSearching(true);
    try {
      const url = q ? `/api/conversations?q=${encodeURIComponent(q)}` : '/api/conversations';
      const res = await fetch(url);
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConversations(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load a conversation into the review screen
  const selectConversationForReview = async (conversationId) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveConversation(data.conversation);
        setActiveItems(data.items);
        setActiveTab('review');
      }
    } catch (err) {
      console.error('Error loading conversation for review:', err);
    }
  };

  // When extraction finishes from Ingest screen
  const handleExtractionComplete = (result) => {
    setActiveConversation(result.conversation);
    setActiveItems(result.items);
    setActiveTab('review');
    fetchConversations();
    if (projects[0]?.id) {
      fetchTasks(projects[0].id);
    }
  };

  const fetchTasks = async (projectId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`);
      if (res.ok) {
        setTasks(await res.json());
      }
    } catch (e) {
      console.error('Error reloading tasks:', e);
    }
  };

  // Item confirmations
  const handleItemConfirmed = async (itemId) => {
    try {
      const res = await fetch(`/api/items/${itemId}/confirm`, { method: 'POST' });
      if (res.ok) {
        const confirmedData = await res.json();
        // Update local item list
        setActiveItems(prev => prev.map(item => 
          item.id === itemId 
            ? { ...item, review_status: 'confirmed', resolved_task_id: confirmedData.item.resolved_task_id }
            : item
        ));

        // Reload tasks and conversations counts
        if (projects[0]?.id) fetchTasks(projects[0].id);
        fetchConversations();
      }
    } catch (err) {
      console.error('Error confirming item:', err);
    }
  };

  const handleBatchConfirm = async (itemIds) => {
    try {
      const res = await fetch('/api/items/batch-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: itemIds })
      });

      if (res.ok) {
        const data = await res.json();
        const confirmedMap = new Map(data.items.map(i => [i.id, i]));
        setActiveItems(prev => prev.map(item => {
          if (confirmedMap.has(item.id)) {
            const updated = confirmedMap.get(item.id);
            return {
              ...item,
              review_status: 'confirmed',
              resolved_task_id: updated.resolved_task_id
            };
          }
          return item;
        }));

        if (projects[0]?.id) fetchTasks(projects[0].id);
        fetchConversations();
      }
    } catch (err) {
      console.error('Error batch confirming:', err);
    }
  };

  const handleItemRejected = async (itemId) => {
    try {
      const res = await fetch(`/api/items/${itemId}/reject`, { method: 'POST' });
      if (res.ok) {
        setActiveItems(prev => prev.map(item => 
          item.id === itemId ? { ...item, review_status: 'rejected' } : item
        ));
        fetchConversations();
      }
    } catch (err) {
      console.error('Error rejecting item:', err);
    }
  };

  const handleItemUpdated = async (itemId, patch) => {
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      if (res.ok) {
        const updated = await res.json();
        setActiveItems(prev => prev.map(item => 
          item.id === itemId ? { ...item, ...updated } : item
        ));
      }
    } catch (err) {
      console.error('Error updating item:', err);
    }
  };

  const handleAssignNewStakeholder = async (itemId, stakeholderData) => {
    try {
      const res = await fetch(`/api/items/${itemId}/assign-new-stakeholder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stakeholderData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create stakeholder');
      }
      const data = await res.json();

      // Add to stakeholders list if not already present
      setStakeholders(prev => {
        const exists = prev.some(s => s.id === data.stakeholder.id);
        return exists ? prev : [...prev, data.stakeholder];
      });

      // Update activeItems with new stakeholder assignment and cleared flags
      setActiveItems(prev => prev.map(item =>
        item.id === itemId ? {
          ...item,
          ...data.item,
          assigned_to_stakeholder_id: data.stakeholder.id,
          assigned_to_resolved_name: data.stakeholder.name,
          stakeholder_role: data.stakeholder.role,
          validation_flags: data.item.validation_flags || []
        } : item
      ));

      return data;
    } catch (err) {
      console.error('Error assigning new stakeholder:', err);
      alert(err.message);
      throw err;
    }
  };

  const handleDeleteConversation = async (convId) => {
    if (!window.confirm('Delete this conversation and its extraction records?')) return;
    try {
      await fetch(`/api/conversations/${convId}`, { method: 'DELETE' });
      fetchConversations();
      if (activeConversation?.id === convId) {
        setActiveConversation(null);
        setActiveItems([]);
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  const pendingCount = activeItems.filter(i => i.review_status === 'pending_review').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-zinc-200 flex flex-col font-sans text-slate-900 selection:bg-black selection:text-white">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        pendingCount={pendingCount}
        engineStatus={engineStatus}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'ingest' && (
          <IngestScreen 
            onExtractionComplete={handleExtractionComplete}
            demoTranscripts={demoTranscripts}
            projects={projects}
          />
        )}

        {activeTab === 'review' && (
          <ReviewScreen 
            conversation={activeConversation}
            items={activeItems}
            stakeholders={stakeholders}
            onItemConfirmed={handleItemConfirmed}
            onBatchConfirm={handleBatchConfirm}
            onItemRejected={handleItemRejected}
            onItemUpdated={handleItemUpdated}
            onAssignNewStakeholder={handleAssignNewStakeholder}
            onOpenSourceModal={(snippet) => {
              setModalHighlight(snippet);
              setModalOpen(true);
            }}
          />
        )}

        {activeTab === 'memory' && (
          <HistoryScreen 
            conversations={conversations}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSelectConversation={selectConversationForReview}
            onDeleteConversation={handleDeleteConversation}
            isLoading={isSearching}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksScreen 
            tasks={tasks}
            onSelectConversation={selectConversationForReview}
          />
        )}
      </main>

      {/* Full Source Transcript Drawer/Modal */}
      <SourceTranscriptModal 
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalHighlight(null);
        }}
        conversation={activeConversation}
        highlightSnippet={modalHighlight}
      />
    </div>
  );
}
