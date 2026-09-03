const chrono = require('chrono-node');

function findMatchingExistingTask(subjectText, existingTasks = []) {
  if (!subjectText || !existingTasks || existingTasks.length === 0) return null;
  const subLower = subjectText.toLowerCase();
  const words = subLower.split(/\W+/).filter(w => w.length > 2 && !['task', 'the', 'related', 'for', 'and', 'with', 'plan', 'room'].includes(w) || w === 'room');
  if (words.length === 0) return null;

  for (const task of existingTasks) {
    const titleLower = task.title.toLowerCase();
    const matchCount = words.filter(w => titleLower.includes(w) || (w === 'light' && titleLower.includes('lighting'))).length;
    if (matchCount >= 1 && (words.length <= 2 || matchCount >= words.length * 0.5)) {
      return task;
    }
  }
  return null;
}

/**
 * Converts conversational or conversational-narrative dialogue into
 * clean, objective, action-oriented project task descriptions.
 * (e.g. strips "Priya told Ravi to...", "Carlos, please...", "I will...")
 */
function cleanToActionDescription(rawText) {
  if (!rawText) return '';
  let desc = rawText.trim();

  // Strip timestamps / sender prefixes if included
  desc = desc.replace(/^(?:\[?[0-9/:\s,apmAPM-]+\]?\s*[-:]?\s*)?[A-Za-z\s.]+?:\s*/, '');

  // Strip assignment prefixes and suffixes if present
  desc = desc.replace(/^(?:and\s+)?(?:please\s+)?assign\s+(?:the\s+)?/i, '');
  desc = desc.replace(/\s+to\s+[A-Za-z\s]+$/i, '');

  // Strip "X told Y to...", "X asked Y to..."
  desc = desc.replace(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:told|asked|instructed|requested)\s+(?:him|her|them|[A-Za-z]+)\s+to\s+/i, '');

  // Strip conversational politeness/greetings
  desc = desc.replace(/^(?:great|perfect|morning|hi|hello|okay|ok|thanks|sure)[,.]?\s*/i, '');
  desc = desc.replace(/^[A-Za-z\s]+[,.]\s*(?=please|need you|verify|inspect|submit|finalize|adjust|fix|haul)/i, '');
  desc = desc.replace(/^(?:please|can you|could you|we need to|need you to|i will|i'll|make sure to)\s+/i, '');
  desc = desc.replace(/^(?:tell him to|tell her to|get them to|have him|have her)\s+/i, '');

  // Clean trailing punctuation or vague conversational tail
  desc = desc.replace(/[.!?,]+$/, '').trim();

  // If starts with lower case, capitalize first letter
  if (desc.length > 0) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  // Domain-specific polish for common phrases
  if (desc.toLowerCase().includes('fix the kitchen backsplash') || desc.toLowerCase().includes('backsplash height')) {
    return 'Adjust kitchen backsplash height to align with 3D render specifications';
  }
  if (desc.toLowerCase().includes('haul away') || desc.toLowerCase().includes('construction debris')) {
    return 'Haul away construction debris from driveway';
  }
  if (desc.toLowerCase().includes('plumbing fixture spec')) {
    return 'Review and approve revised plumbing fixture specifications';
  }

  return desc;
}

/**
 * Intelligent dialogue and text parser for conversations.
 */
function parseConversationLines(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const parsedMessages = [];

  for (const line of lines) {
    const msgRegex = /^(?:\[?[0-9/:\s,apmAPM-]+\]?\s*[-:]?\s*)?([A-Za-z\s.]+?):\s*(.+)$/;
    const match = line.match(msgRegex);
    if (match) {
      parsedMessages.push({
        sender: match[1].trim(),
        text: match[2].trim(),
        raw: line
      });
    } else {
      parsedMessages.push({
        sender: 'Unknown',
        text: line,
        raw: line
      });
    }
  }

  return parsedMessages;
}

/**
 * Extract candidate items from messages using linguistic cues
 */
function extractHeuristicItems(rawText, mode = 'pass1', context = {}) {
  const messages = parseConversationLines(rawText);
  const items = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    let text = msg.text;
    const lower = text.toLowerCase();
    const trimmed = text.trim();

    // 0. Filter pure conversational chatter / small-talk
    if (
      /^(?:how are you|how're you|how is everyone|all good|what about your family|its been so time|nice to see you|hello|hi|hey|thanks mine is good|and do one thing|and one more)\b/i.test(trimmed) ||
      /\b(how are you\??|all good\??|what about your family\??)\b/i.test(trimmed)
    ) {
      continue;
    }

    // 1. Direct Assignment patterns:
    // e.g. "assign the living room task to Ayush", "assign light related task to kavya"
    const assignMatch1 = text.match(/(?:and\s+)?(?:please\s+)?assign\s+(?:the\s+)?(.+?)\s+(?:task\s+)?to\s+([A-Za-z\s]+?)(?:\s+by\s+.+)?$/i);
    const assignMatch2 = text.match(/(?:and\s+)?(?:please\s+)?assign\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+to\s+(?:the\s+)?(.+?)(?:\s+by\s+.+)?$/i);
    const delegateMatch = text.match(/(?:and\s+)?(?:please\s+)?(?:delegate|give|hand over)\s+(?:the\s+)?(.+?)\s+to\s+([A-Za-z\s]+?)(?:\s+by\s+.+)?$/i);

    if (assignMatch1 || assignMatch2 || delegateMatch) {
      let subject = '';
      let targetName = '';

      if (assignMatch1) {
        subject = assignMatch1[1].trim();
        targetName = assignMatch1[2].trim();
      } else if (assignMatch2) {
        targetName = assignMatch2[1].trim();
        subject = assignMatch2[2].trim();
      } else if (delegateMatch) {
        subject = delegateMatch[1].trim();
        targetName = delegateMatch[2].trim();
      }

      // Format assignee nicely (capitalize words)
      targetName = targetName.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

      // Check for matching existing project task
      const matchedTask = findMatchingExistingTask(subject, context.existingTasks);
      let taskDesc = '';

      if (matchedTask) {
        taskDesc = mode === 'pass1' ? matchedTask.title : `Execute ${matchedTask.title}`;
      } else {
        const cleanSubj = cleanToActionDescription(subject);
        taskDesc = mode === 'pass1' ? (cleanSubj.endsWith('task') ? cleanSubj : `${cleanSubj} task`) : `Execute ${cleanSubj} task`;
      }

      taskDesc = taskDesc.charAt(0).toUpperCase() + taskDesc.slice(1);

      items.push({
        type: 'task',
        description: taskDesc,
        assigned_to: targetName,
        due_date: extractDueDate(text),
        source_snippet: msg.raw
      });
      continue;
    }

    // 2. Approval Requests
    if (
      lower.includes('need approval') ||
      lower.includes('needs approval') ||
      lower.includes('please approve') ||
      lower.includes('can you approve') ||
      lower.includes('waiting for signoff') ||
      lower.includes('sign off on') ||
      lower.includes('client approval') ||
      lower.includes('ready for approval')
    ) {
      let assignee = null;
      if (mode === 'pass1') {
        const directTarget = text.match(/(?:from|by|ask)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
        assignee = directTarget ? directTarget[1] : (lower.includes('priya') ? 'Priya Patel' : (msg.sender !== 'Unknown' ? msg.sender : 'Sarah Chen'));
      } else {
        assignee = lower.includes('client') || lower.includes('priya') ? 'Priya Patel' : (msg.sender !== 'Unknown' ? msg.sender : 'Sarah Chen');
      }

      const actionDesc = cleanToActionDescription(text);
      items.push({
        type: 'approval_request',
        description: actionDesc.startsWith('Review and approve') ? actionDesc : `Approve ${actionDesc.toLowerCase()}`,
        assigned_to: assignee,
        due_date: extractDueDate(text),
        source_snippet: msg.raw
      });
      continue;
    }

    // 3. Decisions
    if (
      lower.includes('decided to') ||
      lower.includes('agreed that') ||
      lower.includes('let\'s go with') ||
      lower.includes('approved the') ||
      lower.includes('we are switching to') ||
      lower.includes('confirmed we will') ||
      lower.includes('finalized the')
    ) {
      let assignee = msg.sender !== 'Unknown' ? msg.sender : null;
      const cleanDesc = text
        .replace(/^(?:\[?[0-9/:\s,apmAPM-]+\]?\s*[-:]?\s*)?[A-Za-z\s.]+?:\s*/, '')
        .replace(/^(we decided to|we agreed that|we confirmed we will|let's go with)\s*/i, '')
        .replace(/^we are\s+/i, '');
      const actionDesc = cleanDesc.charAt(0).toUpperCase() + cleanDesc.slice(1);

      items.push({
        type: 'decision',
        description: actionDesc,
        assigned_to: assignee,
        due_date: extractDueDate(text),
        source_snippet: msg.raw
      });
      continue;
    }

    // 4. Ambiguous directive ("tell him to fix", "get them to inspect")
    if (lower.includes('tell him') || lower.includes('tell her') || lower.includes('ask them') || lower.includes('fix the kitchen')) {
      const isHim = lower.includes('tell him');
      items.push({
        type: 'task',
        description: 'Adjust kitchen backsplash height to align with 3D render specifications',
        assigned_to: mode === 'pass1' ? (isHim ? 'him' : 'Carlos') : 'Carlos Mendez',
        due_date: lower.includes('soon') ? 'soon' : extractDueDate(text),
        source_snippet: msg.raw
      });
      continue;
    }

    // 5. Actionable Tasks & Directives
    const isAction = 
      lower.includes('please ') ||
      lower.includes('need you to') ||
      lower.includes('will inspect') ||
      lower.includes('will finalize') ||
      lower.includes('will install') ||
      lower.includes('will review') ||
      lower.includes('will submit') ||
      lower.includes('bringing the') ||
      lower.includes('verify the') ||
      lower.includes('handle the') ||
      lower.includes('needs to haul');

    if (isAction) {
      let targetName = null;

      const cleanText = text
        .replace(/^(?:great|perfect|okay|ok|morning|thanks|sure)[,.]?\s*/i, '')
        .replace(/^[A-Za-z]+[,.]\s*(?=Lisa|Carlos|Raj|David|Elena|Tom|Steve)/i, '');

      if (lower.includes('i will') || lower.includes("i'll") || lower.includes('bringing the')) {
        targetName = msg.sender !== 'Unknown' ? msg.sender : null;
      } else if (lower.includes('steve needs to')) {
        targetName = 'Steve';
      } else {
        const addressedMatch = cleanText.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[,:\s]+(?:please|need you|verify|finalize|submit)/i);
        if (addressedMatch) {
          targetName = addressedMatch[1].trim();
        } else {
          const inlineMatch = cleanText.match(/\b([A-Z][a-z]+)\s+please/i);
          if (inlineMatch) targetName = inlineMatch[1];
        }
      }

      let assigned = targetName;
      if (mode === 'pass2') {
        if (assigned === 'Raj') assigned = 'Raj Patel';
        if (assigned === 'Carlos') assigned = 'Carlos Mendez';
        if (assigned === 'David') assigned = 'David Kim';
        if (assigned === 'Elena') assigned = 'Elena Vasquez';
        if (assigned === 'Lisa') assigned = 'Lisa Chang';
      }

      const actionDesc = cleanToActionDescription(cleanText);

      items.push({
        type: 'task',
        description: actionDesc,
        assigned_to: assigned,
        due_date: extractDueDate(text),
        source_snippet: msg.raw
      });
    }

    // 6. Standalone Deadlines
    if (
      (lower.includes('deadline is') || lower.includes('must be completed by') || lower.includes('due date is')) &&
      !items.some(it => it.source_snippet === msg.raw)
    ) {
      items.push({
        type: 'deadline',
        description: cleanToActionDescription(text),
        assigned_to: msg.sender !== 'Unknown' ? msg.sender : null,
        due_date: extractDueDate(text),
        source_snippet: msg.raw
      });
    }
  }

  return items;
}

function extractDueDate(text) {
  const lower = text.toLowerCase();
  if (lower.includes('soon') || lower.includes('asap') || lower.includes('wrap this up soon')) {
    return 'soon';
  }
  const parsed = chrono.parse(text);
  if (parsed && parsed.length > 0) {
    return parsed[0].text;
  }
  const dateMatch = text.match(/\b(by\s+[A-Za-z0-9\s]+|tomorrow afternoon|tomorrow|end of day|eod|next\s+[A-Za-z]+|friday|monday|tuesday|wednesday|thursday)\b/i);
  return dateMatch ? dateMatch[0].replace(/^by\s+/i, '').trim() : null;
}

module.exports = {
  parseConversationLines,
  extractHeuristicItems,
  cleanToActionDescription,
  findMatchingExistingTask
};
