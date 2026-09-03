const DEMO_TRANSCRIPTS = [
  {
    id: 'demo-1-happy-path',
    title: 'Living Room Flooring & MEP Sync',
    source_type: 'whatsapp',
    description: 'Clean, verified workflow. All assignees exist in project directory and deadlines are precise.',
    raw_text: `[09:14 AM] Sarah Chen: Morning everyone. Quick sync on the Whitfield Residence living room work.
[09:15 AM] Carlos Mendez: On site now. Drywall framing is 95% complete.
[09:16 AM] Raj Patel: Sarah, I will inspect the living room electrical rough-in and subpanel wiring by this Friday.
[09:18 AM] Sarah Chen: Perfect Raj. Lisa, please submit the final hardwood flooring samples for client review by tomorrow afternoon.
[09:19 AM] Lisa Chang: Will do Sarah! Bringing the white oak and herringbone samples at 2 PM tomorrow.
[09:21 AM] Mike Rodriguez: Priya approved the neutral palette concept for the entryway yesterday.
[09:23 AM] Sarah Chen: Great, Carlos please verify the ceiling height clearance before duct insulation starts on Monday.`
  },
  {
    id: 'demo-2-ambiguity-conflict',
    title: 'Kitchen Backsplash & Fixtures Urgency (Ambiguous)',
    source_type: 'whatsapp',
    description: 'Contains ambiguous pronouns ("tell him to fix it"), unverified names, and vague deadlines ("soon"), intentionally triggering AI conflict and validation flags.',
    raw_text: `[11:02 AM] Priya Patel: Hi Carlos, we just stopped by the house. The kitchen tile backsplash height looks way off from the 3D render.
[11:04 AM] Carlos Mendez: Let me take a look with the crew right away.
[11:06 AM] Priya Patel: Please tell him to fix the kitchen backsplash height before the countertop arrives.
[11:08 AM] Carlos Mendez: Understood Mrs. Patel. Let's wrap this up soon so cabinet installation isn't delayed.
[11:10 AM] Sarah Chen: Can you approve the revised plumbing fixture spec from Tom O'Brien by next Wednesday?
[11:12 AM] Priya Patel: Approved, but Steve needs to haul away the construction debris from the driveway today.
[11:15 AM] Sarah Chen: Noted. We decided to relocate the island pendant switches to the east wall.`
  },
  {
    id: 'demo-3-duplicate-change',
    title: 'HVAC Ducting & Island Electrical Coordination',
    source_type: 'meeting',
    description: 'Meeting transcript discussing HVAC duct routing and island wiring that triggers duplicate detection against Task #30000000-0000-0000-0000-000000000003 and creates change requests.',
    raw_text: `Meeting Transcript: Whitfield Residence Weekly Contractor Sync
Attendees: Sarah Chen (PM), Elena Vasquez (MEP), Raj Patel (Electrician), Carlos Mendez (Site)

Sarah Chen: Let's discuss the kitchen island changes. Elena, what is the status of the HVAC review?
Elena Vasquez: We completed the HVAC duct routing review yesterday. As noted, the island placement requires rerouting conduit paths through the ceiling soffit.
Sarah Chen: Raj Patel, please finalize the MEP Systems Review and conduit rework by October 15.
Raj Patel: I will handle the revised kitchen electrical wiring plan accordingly.
Sarah Chen: We agreed that we are switching to low-voltage recessed LED fixtures in the hallway.
Elena Vasquez: We need formal client signoff on the additional structural penetrations before drilling.`
  }
];

module.exports = {
  DEMO_TRANSCRIPTS
};
