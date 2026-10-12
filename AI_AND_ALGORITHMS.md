# AI & ALGORITHMS USED
## Smart Public Grievance Escalation System

---

## 1. RULE-BASED AI — Priority Assignment

### What is it?
A **Rule-Based Expert System** — one of the oldest and most reliable forms of AI.
It mimics how a human expert makes decisions using a set of IF-THEN rules.

### Where is it implemented?
**File:** `backend-node/server.js`
**Function:** `assignPriority(description, category)` — Line 160

### How it works:

```
STEP 1: User submits complaint
         ↓
STEP 2: System reads:
         - Category (Water Supply, Health, Roads...)
         - Description text (emergency, broken, urgent...)
         ↓
STEP 3: Apply Rules:

  IF category contains "water" OR "electricity" OR "health" OR "safety"
    → Priority = HIGH

  ELSE IF description contains "urgent" OR "emergency" OR "critical" OR "danger"
    → Priority = HIGH

  ELSE IF category contains "roads" OR "sanitation" OR "transportation"
    → Priority = MEDIUM

  ELSE IF description contains "broken" OR "damaged" OR "not working"
    → Priority = MEDIUM

  ELSE
    → Priority = LOW
         ↓
STEP 4: Priority assigned automatically (High / Medium / Low)
```

### Actual Code:
```javascript
function assignPriority(description, category) {
  const descLower = description.toLowerCase();
  const catLower = category.toLowerCase();

  // HIGH priority keywords
  const highKeywords = ['urgent', 'emergency', 'critical', 'danger',
                        'life', 'death', 'severe', 'immediate',
                        'accident', 'fire', 'flood', 'leak'];

  // HIGH priority categories
  const highCategories = ['health', 'safety', 'water', 'electricity'];

  if (highKeywords.some(k => descLower.includes(k)) ||
      highCategories.some(c => catLower.includes(c))) {
    return 'High';
  }

  // MEDIUM priority categories
  const mediumCategories = ['roads', 'sanitation', 'transportation'];
  if (mediumCategories.some(c => catLower.includes(c))) {
    return 'Medium';
  }

  // MEDIUM priority keywords
  const mediumKeywords = ['broken', 'damaged', 'not working',
                          'repair', 'fix', 'bad', 'poor', 'faulty'];
  if (mediumKeywords.some(k => descLower.includes(k))) {
    return 'Medium';
  }

  return 'Low';
}
```

### Priority Rules Table:

| Priority | Categories | Keywords |
|----------|-----------|---------|
| HIGH | Water Supply, Electricity, Health, Safety | urgent, emergency, critical, danger, fire, flood, leak, accident |
| MEDIUM | Roads, Sanitation, Transportation | broken, damaged, not working, repair, fix, bad, poor, faulty |
| LOW | Education, Other | (everything else) |

### Why Rule-Based AI?
- Simple and transparent — easy to explain
- No training data needed
- 100% predictable results
- Fast execution (milliseconds)
- Easy to update rules
- Used in real government systems worldwide

---

## 2. SLA-BASED ESCALATION ALGORITHM

### What is it?
A **Time-Based Automated Decision Algorithm** that monitors complaint deadlines
and automatically escalates overdue complaints without human intervention.

### Where is it implemented?
**File:** `backend-node/server.js`
**Function:** `checkAndEscalateComplaints()` — Line 418
**Trigger:** `setInterval()` — runs every 5 minutes

### How it works:

```
EVERY 5 MINUTES:
         ↓
STEP 1: Scan all complaints in database
         ↓
STEP 2: Check condition:
  IF complaint.status NOT IN (Resolved, Closed)
  AND complaint.sla_deadline < current_time
  AND complaint.escalation_level < 2
         ↓
STEP 3: Escalate:
  - Change status → "Escalated"
  - Increment escalation_level (0 → 1 → 2)
  - Log in escalation_log table
  - Send notification to user
         ↓
STEP 4: Repeat after 5 minutes
```

### SLA Deadline Calculation:
**File:** `backend-node/server.js`
**Function:** `calculateSLADeadline(priority)` — Line 195

```
HIGH Priority   → Deadline = Now + 24 hours
MEDIUM Priority → Deadline = Now + 48 hours
LOW Priority    → Deadline = Now + 72 hours
```

### Actual Code:
```javascript
function calculateSLADeadline(priority) {
  const now = new Date();
  let hours = 72; // Default Low priority

  if (priority === 'High')   hours = 24;
  if (priority === 'Medium') hours = 48;

  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

// Runs every 5 minutes
setInterval(checkAndEscalateComplaints, 5 * 60 * 1000);
```

### Escalation Flow:
```
Complaint Submitted
       ↓
SLA Deadline Set (24h / 48h / 72h)
       ↓
Officer Works on Complaint
       ↓
[If NOT resolved before deadline]
       ↓
Auto-Escalation Triggered
       ↓
Status → "Escalated"
       ↓
User Notified
       ↓
[If STILL not resolved]
       ↓
Level 2 Escalation (max)
```

---

## 3. INTELLIGENT OFFICER ASSIGNMENT ALGORITHM

### What is it?
A **Category-Based Matching Algorithm** that automatically assigns
complaints to the most suitable department officer.

### Where is it implemented?
**File:** `backend-node/server.js`
**Function:** `autoAssignOfficer(category)` — Line 209

### How it works:

```
STEP 1: User submits complaint with category "Water Supply"
         ↓
STEP 2: System queries database:
  "Find officer WHERE department = 'Water Supply'"
         ↓
STEP 3a: If matching officer found
  → Assign complaint to that officer
         ↓
STEP 3b: If NO matching officer found
  → Assign to any available officer (fallback)
         ↓
STEP 4: Officer receives notification
```

### Department Matching:

| Complaint Category | Assigned Officer |
|-------------------|-----------------|
| Water Supply | water.officer@gov.in |
| Electricity | electricity.officer@gov.in |
| Roads | roads.officer@gov.in |
| Health | health.officer@gov.in |
| Sanitation | sanitation.officer@gov.in |
| Safety | safety.officer@gov.in |

### Actual Code:
```javascript
async function autoAssignOfficer(category) {
  // Find officer matching the department
  const [officers] = await pool.query(
    'SELECT id FROM users WHERE role = "officer" AND department = ?
     ORDER BY RAND() LIMIT 1',
    [category]
  );

  if (officers.length > 0) {
    return officers[0].id; // Return matched officer
  }

  // Fallback: assign to any available officer
  const [anyOfficer] = await pool.query(
    'SELECT id FROM users WHERE role = "officer" ORDER BY RAND() LIMIT 1'
  );

  return anyOfficer.length > 0 ? anyOfficer[0].id : null;
}
```

---

## 4. NOTIFICATION INTELLIGENCE SYSTEM

### What is it?
A **Multi-Channel Event-Driven Notification System** that automatically
sends the right notification to the right person at the right time.

### Where is it implemented?
**File:** `backend-node/server.js`
**Function:** `createNotification()`, `notifyAdminAboutComplaint()`

### How it works:

```
EVENT OCCURS (complaint submitted, status changed, escalated)
         ↓
SYSTEM DECIDES:
  - WHO to notify (user / officer / admin)
  - WHAT type (success / info / warning / error)
  - WHICH channel (in-app / email / SMS)
         ↓
NOTIFICATIONS SENT:
  → In-App: Bell icon in dashboard
  → Email: HTML email to admin
  → SMS: Text message to admin phone
```

### Notification Decision Table:

| Event | Who Gets Notified | Type | Channel |
|-------|------------------|------|---------|
| Complaint submitted | User | Success | In-App |
| Complaint assigned | Officer | Info | In-App |
| Status updated | User | Info/Success | In-App |
| SLA escalated | User | Warning | In-App |
| New complaint | Admin | Warning | In-App + Email + SMS |

---

## 5. COMPLETE AI SYSTEM FLOW

```
┌─────────────────────────────────────────────────────────┐
│                  USER SUBMITS COMPLAINT                  │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│         AI #1: RULE-BASED PRIORITY ASSIGNMENT           │
│  Analyzes category + keywords → High / Medium / Low     │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│         ALGO #1: SLA DEADLINE CALCULATION               │
│  High=24h, Medium=48h, Low=72h deadline set             │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│         ALGO #2: OFFICER ASSIGNMENT MATCHING            │
│  Category matched to department officer                 │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│         ALGO #3: NOTIFICATION ROUTING                   │
│  User + Officer + Admin notified automatically          │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│         AI #2: SLA MONITORING (Every 5 min)             │
│  Checks deadlines → Auto-escalates if overdue           │
└─────────────────────────────────────────────────────────┘
```

---

## 6. SUMMARY TABLE

| # | AI / Algorithm | Type | File | Function | Purpose |
|---|---------------|------|------|----------|---------|
| 1 | Priority Assignment | Rule-Based AI | server.js | assignPriority() | Auto-assign High/Medium/Low |
| 2 | SLA Calculation | Mathematical Algorithm | server.js | calculateSLADeadline() | Set response deadlines |
| 3 | Auto-Escalation | Time-Based Algorithm | server.js | checkAndEscalateComplaints() | Escalate overdue complaints |
| 4 | Officer Assignment | Matching Algorithm | server.js | autoAssignOfficer() | Assign to right department |
| 5 | Notification Routing | Event-Driven Algorithm | server.js | notifyAdminAboutComplaint() | Multi-channel notifications |

---

## 7. AI TYPE EXPLANATION

### Rule-Based AI (Expert System)
- **Definition:** AI that uses predefined IF-THEN rules to make decisions
- **Used for:** Priority assignment
- **Advantage:** Transparent, fast, reliable, no training needed
- **Real-world use:** Medical diagnosis systems, loan approval systems, government portals

### Algorithm (Non-AI but Intelligent)
- **Definition:** Step-by-step procedure to solve a problem
- **Used for:** SLA calculation, officer matching, escalation
- **Advantage:** Deterministic, predictable, efficient

---

## 8. FOR YOUR REVIEW PRESENTATION

**Key Points to Mention:**

1. "We implemented a **Rule-Based AI Expert System** for priority assignment"
2. "The AI analyzes both the **category** and **description keywords** to determine priority"
3. "We use a **Time-Based Escalation Algorithm** that runs every 5 minutes"
4. "An **Intelligent Matching Algorithm** automatically assigns complaints to the right officer"
5. "The system uses **Event-Driven Notification Routing** for multi-channel alerts"

**Technical Terms to Use:**
- Rule-Based Expert System
- Natural Language Keyword Analysis
- SLA (Service Level Agreement) Monitoring
- Automated Escalation Pipeline
- Intelligent Department Matching
- Event-Driven Architecture

---

*File: AI_AND_ALGORITHMS.md*
*Project: Smart Public Grievance Escalation System*
*Last Updated: March 2026*
