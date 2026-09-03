/**
 * Routes items to 'auto_confirmed' or 'pending_review' based on
 * consensus between independent passes and deterministic validation.
 */
function routeItems(validatedItems = []) {
  return validatedItems.map(item => {
    const isMatch = item.agreement_status === 'match';
    const hasFlags = Array.isArray(item.validation_flags) && item.validation_flags.length > 0;
    const hasUnresolvedAssignee = item.type === 'task' && !item.assigned_to_stakeholder_id;
    const hasUnparseableDate = item.due_date_raw && !item.due_date_parsed;

    let review_status = 'pending_review';
    const reasons = [];

    if (item.agreement_status === 'conflict') {
      const conflictFields = item.conflict_details?.conflict_fields?.join(', ') || 'fields';
      reasons.push(`⚠️ Conflicting extraction between AI passes (${conflictFields})`);
    } else if (item.agreement_status === 'unique_pass1') {
      reasons.push('⚠️ Unverified item (detected only in Pass 1)');
    } else if (item.agreement_status === 'unique_pass2') {
      reasons.push('⚠️ Unverified item (detected only in Pass 2 PM review)');
    }

    if (item.validation_flags && item.validation_flags.length > 0) {
      for (const flag of item.validation_flags) {
        if (flag.code === 'UNRESOLVED_ASSIGNEE') {
          reasons.push(`⚠️ Assignee not found in project directory ("${item.assigned_to_raw || 'none'}")`);
        } else if (flag.code === 'UNPARSEABLE_DATE') {
          reasons.push(`⚠️ Deadline is vague or unparseable ("${item.due_date_raw}")`);
        } else if (flag.code === 'POSSIBLE_DUPLICATE') {
          reasons.push(`⚠️ ${flag.message}`);
        }
      }
    }

    if (isMatch && !hasFlags && !hasUnresolvedAssignee && !hasUnparseableDate) {
      review_status = 'auto_confirmed';
    } else {
      review_status = 'pending_review';
    }

    return {
      ...item,
      review_status,
      review_reasons: reasons
    };
  });
}

module.exports = {
  routeItems
};
