const chrono = require('chrono-node');
const levenshtein = require('fast-levenshtein');
const { calculateSimilarity } = require('./comparePasses');

/**
 * Fuzzy matches raw assignee name against project stakeholders list
 */
function resolveStakeholder(rawName, stakeholders = []) {
  if (!rawName) return null;
  const clean = rawName.trim().toLowerCase();
  
  // Ambiguous pronouns
  if (['him', 'her', 'them', 'they', 'someone', 'anyone', 'all', 'team'].includes(clean)) {
    return null;
  }

  // 1. Exact full name match (case-insensitive)
  const exact = stakeholders.find(s => s.name.toLowerCase() === clean);
  if (exact) return exact;

  // 2. First name exact match (e.g. "Carlos" -> "Carlos Mendez", "Raj" -> "Raj Patel")
  const firstNameMatches = stakeholders.filter(s => {
    const sFirst = s.name.split(' ')[0].toLowerCase();
    return sFirst === clean;
  });
  if (firstNameMatches.length === 1) return firstNameMatches[0];

  // 3. Substring match (e.g. "Dr. James Wright" matching "James Wright" or "Wright")
  const subMatch = stakeholders.find(s => {
    const sName = s.name.toLowerCase();
    return sName.includes(clean) || clean.includes(sName);
  });
  if (subMatch) return subMatch;

  // 4. Levenshtein distance <= 2 for typos
  let bestStakeholder = null;
  let minDistance = 3;
  for (const s of stakeholders) {
    const dist = levenshtein.get(s.name.toLowerCase(), clean);
    if (dist < minDistance) {
      minDistance = dist;
      bestStakeholder = s;
    }
  }

  return bestStakeholder;
}

/**
 * Parse due date using chrono-node
 */
function parseDateString(rawDate) {
  if (!rawDate) return { date: null, isValid: true };
  const clean = rawDate.trim().toLowerCase();
  
  // Vague non-dates
  if (['soon', 'asap', 'later', 'wrap this up soon', 'shortly', 'tbd'].includes(clean)) {
    return { date: null, isValid: false, reason: 'Vague timeframe' };
  }

  try {
    const parsed = chrono.parseDate(rawDate, new Date());
    if (parsed && !isNaN(parsed.getTime())) {
      return {
        date: parsed.toISOString().slice(0, 10),
        isValid: true
      };
    }
  } catch (e) {
    // ignore
  }

  return { date: null, isValid: false, reason: 'Could not parse into a valid calendar date' };
}

/**
 * Check if candidate item is a near-duplicate of existing project tasks
 */
function findPotentialDuplicate(itemDesc, existingTasks = [], currentConversationId = null) {
  if (!itemDesc || existingTasks.length === 0) return null;

  const descLower = itemDesc.toLowerCase().trim();
  let bestMatch = null;
  let maxScore = 0;

  for (const task of existingTasks) {
    // Skip tasks created by the exact same conversation run
    if (currentConversationId && task.source_conversation_id === currentConversationId) {
      continue;
    }

    const titleLower = task.title.toLowerCase().trim();
    let score = 0;

    // Check 1: Substring containment (e.g. "MEP Systems Review" in "finalize the MEP Systems Review...")
    if (titleLower.length >= 6 && descLower.includes(titleLower)) {
      score = 0.85;
    } else {
      // Check 2: Word containment (if 3+ distinct words in title all appear in description)
      const titleWords = titleLower.split(/\W+/).filter(w => w.length > 2 && !['and', 'for', 'the', 'with', 'plan'].includes(w));
      if (titleWords.length >= 3) {
        const matchingWords = titleWords.filter(w => descLower.includes(w));
        if (matchingWords.length === titleWords.length) {
          score = 0.80;
        } else if (matchingWords.length >= 3 && matchingWords.length / titleWords.length >= 0.75) {
          score = 0.60;
        }
      }

      // Check 3: Standard Jaccard / Levenshtein similarity
      const standardSim = calculateSimilarity(itemDesc, task.title);
      score = Math.max(score, standardSim);
    }

    if (score > maxScore) {
      maxScore = score;
      bestMatch = { task, score };
    }
  }

  if (bestMatch && bestMatch.score >= 0.50) {
    return bestMatch;
  }
  return null;
}

/**
 * Run deterministic validation checks over all extracted items
 */
function validateItems(items = [], context = {}) {
  const { stakeholders = [], existingTasks = [], currentConversationId = null } = context;

  return items.map(item => {
    const flags = [];
    let resolvedStakeholder = null;

    // Check 1: Stakeholder Resolution
    if (!item.assigned_to) {
      if (item.type === 'task') {
        flags.push({
          code: 'UNRESOLVED_ASSIGNEE',
          message: 'Assignee is unspecified'
        });
      }
    } else {
      resolvedStakeholder = resolveStakeholder(item.assigned_to, stakeholders);
      if (!resolvedStakeholder) {
        flags.push({
          code: 'UNRESOLVED_ASSIGNEE',
          message: `Assignee "${item.assigned_to}" cannot be resolved to any project stakeholder`
        });
      }
    }

    // Check 2: Date Parsing
    let parsedDate = null;
    if (item.due_date) {
      const dateResult = parseDateString(item.due_date);
      if (!dateResult.isValid) {
        flags.push({
          code: 'UNPARSEABLE_DATE',
          message: `Deadline "${item.due_date}" is vague or unparseable`
        });
      } else {
        parsedDate = dateResult.date;
      }
    }

    // Check 3: Near-duplicate task check
    let duplicateTaskId = null;
    const duplicateMatch = findPotentialDuplicate(item.description, existingTasks, currentConversationId);
    if (duplicateMatch) {
      duplicateTaskId = duplicateMatch.task.id;
      flags.push({
        code: 'POSSIBLE_DUPLICATE',
        message: `Likely duplicate of Task #${duplicateMatch.task.id.slice(0, 8)} ("${duplicateMatch.task.title}") [${Math.round(duplicateMatch.score * 100)}% match]`,
        taskId: duplicateMatch.task.id,
        taskTitle: duplicateMatch.task.title
      });
    }

    return {
      ...item,
      assigned_to_raw: item.assigned_to || null,
      assigned_to_stakeholder_id: resolvedStakeholder ? resolvedStakeholder.id : null,
      assigned_to_resolved_name: resolvedStakeholder ? resolvedStakeholder.name : null,
      due_date_raw: item.due_date || null,
      due_date_parsed: parsedDate,
      duplicate_task_id: duplicateTaskId,
      validation_flags: flags
    };
  });
}

module.exports = {
  resolveStakeholder,
  parseDateString,
  findPotentialDuplicate,
  validateItems
};
