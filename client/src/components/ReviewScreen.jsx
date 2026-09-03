import React, { useState } from 'react';
import { 
  FileText,
  Check, 
  X, 
  Quote,
  CheckCircle2,
  Calendar,
  User,
  UserPlus,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Plus
} from 'lucide-react';

export default function ReviewScreen({ 
  conversation, 
  items = [], 
  stakeholders = [], 
  onItemConfirmed, 
  onBatchConfirm, 
  onItemRejected, 
  onItemUpdated, 
  onOpenSourceModal,
  onAssignNewStakeholder
}) {
  const [editingItemState, setEditingItemState] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [newMemberModal, setNewMemberModal] = useState({
    open: false,
    itemId: null,
    name: '',
    role: 'Site Engineer',
    email: ''
  });
  const [newMemberLoading, setNewMemberLoading] = useState(false);

  if (!conversation) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16 bg-zinc-50/95 rounded-2xl border border-zinc-300/80 p-8 shadow-md">
        <h3 className="text-sm font-semibold text-zinc-800">No Conversation Selected</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Capture a new conversation or select one from Memory to review the summary and tasks.
        </p>
      </div>
    );
  }

  const summary = conversation.summary || {};
  const pendingItems = items.filter(i => i.review_status !== 'confirmed' && i.review_status !== 'rejected');
  const confirmedItems = items.filter(i => i.review_status === 'confirmed');

  const getDraft = (item) => {
    return editingItemState[item.id] || {
      description: item.description,
      type: item.type,
      assigned_to_stakeholder_id: item.assigned_to_stakeholder_id || '',
      due_date_parsed: item.due_date_parsed ? item.due_date_parsed.slice(0, 10) : ''
    };
  };

  const updateDraft = (itemId, patch) => {
    setEditingItemState(prev => ({
      ...prev,
      [itemId]: {
        ...getDraft({ id: itemId, ...items.find(i => i.id === itemId) }),
        ...patch
      }
    }));
  };

  const handleOpenNewMemberModal = (item, rawName) => {
    setNewMemberModal({
      open: true,
      itemId: item.id,
      name: rawName || item.assigned_to_raw || '',
      role: 'Site Engineer',
      email: ''
    });
  };

  const handleSaveNewMember = async (e) => {
    e.preventDefault();
    if (!newMemberModal.name.trim()) return;
    setNewMemberLoading(true);
    try {
      if (onAssignNewStakeholder) {
        const result = await onAssignNewStakeholder(newMemberModal.itemId, {
          name: newMemberModal.name.trim(),
          role: newMemberModal.role.trim() || 'Team Member',
          email: newMemberModal.email.trim() || null
        });
        if (result?.stakeholder) {
          updateDraft(newMemberModal.itemId, {
            assigned_to_stakeholder_id: result.stakeholder.id
          });
        }
      }
      setNewMemberModal({ open: false, itemId: null, name: '', role: 'Site Engineer', email: '' });
    } catch (err) {
      console.error('Failed to create and assign member:', err);
    } finally {
      setNewMemberLoading(false);
    }
  };

  const handleConfirmItem = async (item) => {
    const draft = getDraft(item);
    setActionLoading(prev => ({ ...prev, [item.id]: true }));
    try {
      if (
        draft.description !== item.description ||
        draft.type !== item.type ||
        draft.assigned_to_stakeholder_id !== (item.assigned_to_stakeholder_id || '') ||
        draft.due_date_parsed !== (item.due_date_parsed ? item.due_date_parsed.slice(0, 10) : '')
      ) {
        await onItemUpdated(item.id, {
          description: draft.description,
          type: draft.type,
          assigned_to_stakeholder_id: draft.assigned_to_stakeholder_id || null,
          due_date_parsed: draft.due_date_parsed || null
        });
      }
      await onItemConfirmed(item.id);
    } finally {
      setActionLoading(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const handleRejectItem = async (item) => {
    setActionLoading(prev => ({ ...prev, [item.id]: true }));
    try {
      await onItemRejected(item.id);
    } finally {
      setActionLoading(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'task':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-200/80 text-zinc-900 border border-zinc-300">Action</span>;
      case 'decision':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-200/80 text-zinc-900 border border-zinc-300">Decision</span>;
      case 'approval_request':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-black text-white">Approval Required</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-200 text-zinc-800">{type}</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/15">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">{conversation.title}</h1>
            <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white font-semibold border border-white/20">
              {conversation.source_type}
            </span>
          </div>
          <p className="text-xs text-zinc-300 mt-0.5">
            {conversation.project_name || 'Whitfield Residence'} • {new Date(conversation.created_at).toLocaleDateString()}
          </p>
        </div>

        <button
          onClick={() => onOpenSourceModal(null)}
          className="self-start sm:self-auto px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <FileText className="w-3.5 h-3.5 text-zinc-300" />
          <span>Full Transcript</span>
        </button>
      </div>

      {/* 1. EXECUTIVE SUMMARY CARD - Soft Matte Dull White */}
      <div className="bg-zinc-50/95 backdrop-blur-md rounded-2xl border border-zinc-300/80 shadow-md p-6 space-y-5 text-zinc-900">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-black"></div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
              Executive Briefing Summary
            </h2>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">Context-Verified</span>
        </div>

        {summary.overview && (
          <p className="text-xs sm:text-sm text-zinc-800 leading-relaxed font-normal bg-zinc-100/90 p-4 rounded-xl border border-zinc-200/80">
            {summary.overview}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Decisions */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-zinc-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-800"></span>
              <span>Key Decisions Reached</span>
            </span>
            {summary.key_decisions && summary.key_decisions.length > 0 ? (
              <ul className="space-y-1.5">
                {summary.key_decisions.map((dec, idx) => (
                  <li key={idx} className="text-xs text-zinc-800 flex items-start gap-2 bg-zinc-100/70 p-2.5 rounded-lg border border-zinc-200/70">
                    <span className="text-zinc-500 font-bold">•</span>
                    <span className="font-medium">{dec}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-500 italic">No formal decisions recorded in this thread.</p>
            )}
          </div>

          {/* Approvals */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-zinc-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-800"></span>
              <span>Pending Approvals & Sign-Offs</span>
            </span>
            {summary.pending_approvals && summary.pending_approvals.length > 0 ? (
              <ul className="space-y-1.5">
                {summary.pending_approvals.map((appr, idx) => (
                  <li key={idx} className="text-xs text-zinc-800 flex items-start gap-2 bg-zinc-100/70 p-2.5 rounded-lg border border-zinc-200/70">
                    <span className="text-zinc-500 font-bold">•</span>
                    <span className="font-medium">{appr}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-500 italic">No outstanding approvals pending.</p>
            )}
          </div>
        </div>

        {summary.discussion_points && summary.discussion_points.length > 0 && (
          <div className="pt-2 border-t border-zinc-200 flex flex-wrap gap-1.5">
            {summary.discussion_points.map((pt, idx) => (
              <span key={idx} className="text-[11px] text-zinc-700 bg-zinc-200/70 px-2.5 py-1 rounded-md">
                {pt}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. TASK REVIEW & CONVERSION QUEUE */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Task Review Queue</h2>
            <p className="text-xs text-zinc-300">
              Verify pre-filled action descriptions before adding them to project tasks.
            </p>
          </div>

          {pendingItems.length > 0 && (
            <button
              onClick={() => onBatchConfirm(pendingItems.map(i => i.id))}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-zinc-100 text-black shadow-md transition-all flex items-center gap-1.5 hover:-translate-y-0.2"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm All ({pendingItems.length})</span>
            </button>
          )}
        </div>

        {pendingItems.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50/95 rounded-2xl border border-zinc-300/80 text-zinc-500 text-xs shadow-md space-y-2">
            <CheckCircle2 className="w-6 h-6 text-zinc-700 mx-auto mb-1" />
            <div className="font-bold text-sm text-zinc-800">
              {items.length === 0 ? "No Actionable Tasks Extracted" : "All Tasks Reviewed & Confirmed"}
            </div>
            <p className="max-w-md mx-auto text-zinc-500">
              {items.length === 0
                ? "The AI analyzed this conversation thread, but found no task assignments, approval requests, or deadlines (the thread may consist of conversational check-ins or informal greetings)."
                : "All actionable tasks from this transcript have been verified and added to the project board."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingItems.map(item => {
              const draft = getDraft(item);
              const isUnresolvedAssignee = !draft.assigned_to_stakeholder_id && item.assigned_to_raw;
              const hasDuplicate = item.duplicate_task_id || item.duplicate_task_title || (item.validation_flags || []).some(f => f.code === 'POSSIBLE_DUPLICATE');

              return (
                <div 
                  key={item.id}
                  className="bg-zinc-50/95 backdrop-blur-md rounded-2xl p-5 border border-zinc-300/80 shadow-sm hover:shadow-md hover:border-zinc-400 transition-all space-y-3.5 text-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getTypeBadge(draft.type)}
                      {item.agreement_status === 'conflict' && (
                        <span className="text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Disagreement Flagged
                        </span>
                      )}
                      {isUnresolvedAssignee && (
                        <span className="text-[11px] font-medium text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          New Member Mentioned
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-500 font-mono">Needs Review</span>
                  </div>

                  {/* PROMINENT FLAGS & WARNINGS BOX */}
                  {(isUnresolvedAssignee || hasDuplicate || (item.agreement_status === 'conflict' && item.conflict_details)) && (
                    <div className="space-y-2 pt-1">
                      {/* 1. Unresolved Assignee Banner with Direct Action */}
                      {isUnresolvedAssignee && (
                        <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-950">
                          <div className="flex items-start gap-2.5">
                            <UserPlus className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Assignee Not in Team Directory:</span>{" "}
                              <span className="font-mono bg-blue-100/90 px-1.5 py-0.5 rounded text-blue-900 font-bold">"{item.assigned_to_raw}"</span>
                              <p className="text-[11px] text-blue-800 mt-0.5">
                                This member was assigned in the transcript but doesn't have a team profile yet. Create their member profile to assign them.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenNewMemberModal(item, item.assigned_to_raw)}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>+ Add "{item.assigned_to_raw}" & Assign</span>
                          </button>
                        </div>
                      )}

                      {/* 2. Potential Duplicate Task Warning */}
                      {hasDuplicate && (
                        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-950">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Potential Duplicate / Related Task:</span>{" "}
                            <span className="font-semibold text-amber-900">"{item.duplicate_task_title || 'Living Room Design Concept'}"</span>
                            <p className="text-[11px] text-amber-800 mt-0.5">
                              A similar deliverable already exists on this project board. Verify whether this updates the existing scope or is an independent task.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 3. Conflict Details */}
                      {item.agreement_status === 'conflict' && item.conflict_details && (
                        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-950">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Multi-Pass Disagreement:</span>{" "}
                            <span className="text-amber-900">
                              AI passes differed on ({item.conflict_details?.conflict_fields?.join(', ') || 'fields'}).
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pre-filled Action Description Input */}
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                      Action Description (Pre-filled by AI)
                    </label>
                    <input
                      type="text"
                      value={draft.description}
                      onChange={(e) => updateDraft(item.id, { description: e.target.value })}
                      className="w-full rounded-xl border border-zinc-300 text-xs sm:text-sm font-medium text-zinc-900 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all bg-white/90"
                    />
                  </div>

                  {/* Metadata Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider">
                          Responsible Owner
                        </label>
                        <button
                          type="button"
                          onClick={() => handleOpenNewMemberModal(item, item.assigned_to_raw || '')}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>+ New Member</span>
                        </button>
                      </div>
                      <select
                        value={draft.assigned_to_stakeholder_id}
                        onChange={(e) => updateDraft(item.id, { assigned_to_stakeholder_id: e.target.value })}
                        className={`w-full rounded-xl border text-xs py-2 px-3 focus:outline-none focus:ring-2 focus:ring-black bg-white/90 ${
                          isUnresolvedAssignee ? 'border-blue-400 ring-1 ring-blue-300' : 'border-zinc-300'
                        }`}
                      >
                        <option value="">-- Select Project Stakeholder --</option>
                        {stakeholders.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={draft.due_date_parsed}
                        onChange={(e) => updateDraft(item.id, { due_date_parsed: e.target.value })}
                        className="w-full rounded-xl border border-zinc-300 text-xs py-2 px-3 focus:outline-none focus:ring-2 focus:ring-black bg-white/90"
                      />
                    </div>
                  </div>

                  {/* Source Snippet Quote */}
                  <div className="bg-zinc-100/90 p-3 rounded-xl border border-zinc-200/80 flex items-start gap-2.5 text-xs text-zinc-700">
                    <Quote className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                    <span className="italic flex-1 truncate">"{item.source_snippet}"</span>
                    <button
                      onClick={() => onOpenSourceModal(item.source_snippet)}
                      className="text-black hover:underline font-semibold text-[11px] shrink-0"
                    >
                      Context
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200">
                    <button
                      type="button"
                      onClick={() => handleRejectItem(item)}
                      disabled={actionLoading[item.id]}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-zinc-600 hover:text-black transition-colors"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmItem(item)}
                      disabled={actionLoading[item.id]}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-black hover:bg-zinc-800 text-white shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm & Create Task</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. NEW MEMBER ONBOARDING MODAL */}
      {newMemberModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-zinc-50 rounded-2xl border border-zinc-300 shadow-2xl max-w-md w-full p-6 space-y-4 text-zinc-900">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Add Member & Assign Task</h3>
                  <p className="text-[11px] text-zinc-500">Create team profile and link to this task</p>
                </div>
              </div>
              <button
                onClick={() => setNewMemberModal({ open: false, itemId: null, name: '', role: 'Site Engineer', email: '' })}
                className="text-zinc-400 hover:text-zinc-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewMember} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newMemberModal.name}
                  onChange={(e) => setNewMemberModal(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Ayush"
                  className="w-full rounded-xl border border-zinc-300 text-xs sm:text-sm font-medium text-zinc-900 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Project Role *
                </label>
                <input
                  type="text"
                  required
                  value={newMemberModal.role}
                  onChange={(e) => setNewMemberModal(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="e.g. Site Engineer, Architect, Designer..."
                  className="w-full rounded-xl border border-zinc-300 text-xs sm:text-sm font-medium text-zinc-900 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['Site Engineer', 'Lead Architect', 'Interior Designer', 'Electrician', 'Site Supervisor', 'Client'].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNewMemberModal(prev => ({ ...prev, role: r }))}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                        newMemberModal.role === r
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:bg-zinc-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={newMemberModal.email}
                  onChange={(e) => setNewMemberModal(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="e.g. ayush@project.com"
                  className="w-full rounded-xl border border-zinc-300 text-xs sm:text-sm font-medium text-zinc-900 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setNewMemberModal({ open: false, itemId: null, name: '', role: 'Site Engineer', email: '' })}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newMemberLoading || !newMemberModal.name.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {newMemberLoading ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create Member & Assign</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. CONFIRMED TASKS */}
      {confirmedItems.length > 0 && (
        <div className="bg-zinc-50/95 backdrop-blur-md rounded-2xl p-5 border border-zinc-300/80 shadow-md space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-zinc-600">
            Confirmed Tasks ({confirmedItems.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {confirmedItems.map(c => (
              <div key={c.id} className="bg-white/90 p-3 rounded-xl border border-zinc-200 text-xs space-y-1 shadow-2xs">
                <span className="font-semibold text-zinc-900 block">{c.description}</span>
                {c.assigned_to_resolved_name && (
                  <span className="text-[11px] text-zinc-600 block">Owner: {c.assigned_to_resolved_name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
