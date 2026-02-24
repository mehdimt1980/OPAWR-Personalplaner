
# OR Staff Planner AI

**Intelligent Operating Room Staffing & Scheduling System**

The **OR Staff Planner AI** is a specialized web application designed for clinical environments (specifically adapted for Klinikum Gütersloh) to automate and optimize the daily allocation of surgical staff (OTA, MFA, Saalleitung) to operating rooms.

It replaces manual whiteboard planning with an algorithmic approach that ensures every room has the right expertise while respecting individual staff schedules, shifts, and vacations.

---

## 🧠 The Core Algorithm: "Greedy + Hill Climbing"

The heart of the application is a two-stage hybrid algorithm designed to find the global optimum for the daily schedule, rather than just filling holes linearly.

### Phase 1: Greedy Construction (The "Common Sense" Pass)
The system iterates through the rooms based on priority (e.g., Robotics/Saal 7 first) and assigns the best available candidates immediately.
*   **Scoring Criteria:** Qualification match (Expert vs Junior), Role match (Saalleitung leads their specific department), and Previous room preferences.
*   **Limitation:** This is fast but "short-sighted". It might burn a perfect candidate on a low-priority room early in the list, leaving a critical room underqualified later.

### Phase 2: Global Optimization (Hill Climbing)
Once the initial plan is built, the **Optimization Engine** takes over.
1.  **Simulation:** It simulates thousands of "swaps" per second.
    *   *Swap Type A:* Swapping an assigned person with someone on the "Bench" (Unassigned).
    *   *Swap Type B:* Swapping staff between two different rooms.
2.  **Evaluation:** After every swap, it recalculates the **Global Schedule Score**.
3.  **Decision:** If a swap increases the total score (e.g., better skill coverage across *all* rooms), it keeps the change.

**Result:** A self-correcting plan that maximizes department expertise coverage and minimizes role conflicts across the entire hospital.

---

## ✨ Key Features

### 1. 👥 Comprehensive Staff Management
Manage your entire team in one digital interface.
*   **Digital Personnel File:** Track Roles (OTA, MFA, Student), Certifications (Praxisanleiter), and specific Department Skills (UCH, ACH, GCH, etc.).
*   **Skill Matrix:** Define expertise levels (`Junior`, `Expert`) for every department to ensure patient safety standards are met during assignment.
*   **Availability:** Manage work days (Mo-Fr), Sick status, and "Joker" status for students/temp staff.

### 2. 📅 Vacation & Absence Management
Prevent scheduling conflicts before they happen.
*   **Vacation Tracking:** Staff on vacation are automatically excluded from the algorithm for the duration of their leave.
*   **Import/Export:** Bulk import annual leave via CSV or manage entries manually in the Staff Modal.
*   **Visual Indicators:** Vacationers appear in the "Resources" sidebar with specific markers.

### 3. ⏱️ Shift Planning & Roster
Beyond daily room assignment, manage the weekly shift rota.
*   **Shift Types:** Supports standard codes like `T1` (Day), `S44` (Late), `N` (Night), `BD` (24h Duty), and `RD` (Standby).
*   **Recovery Logic:** Staff assigned to `BD` (24h) or `N` (Night) are automatically marked as **"Recovery"** for the following day and blocked from assignment.
*   **Weekly View:** A dedicated spreadsheet-style view to plan shifts for the whole week.

### 4. 🚨 Conflict Resolution & Safety
*   **Real-Time Validation:** The app instantly flags:
    *   Double Bookings
    *   Understaffing (Less than 2 people)
    *   Missing Qualifications (e.g., "No URO Expert in Saal 6")
*   **Smart Resolution Wizard:** Click the "Magic Wand" on any error. The AI analyzes the pool and suggests the best 3 candidates to resolve the specific conflict without creating new ones.

### 5. ⚖️ Fairness & Rotation Analytics
Ensure your team is treated fairly and utilized correctly.
*   **Role Fairness:** Detailed charts show the ratio of **Lead** vs. **Springer** assignments for each staff member. Identify who is carrying too much responsibility and who is underutilized.
*   **Room Rotation:** Visualize which rooms staff are working in to prevent silo-ing and ensure rotation between disciplines (e.g., UCH vs. ACH).
*   **Burnout Risk:** Flags staff members who have been assigned to high-stress roles consecutively without break.

### 6. 🔮 Smart Rescheduling Engine (High-Impact Feature)
When room closures or operation cancellations occur due to staff shortages, the system acts as an intelligent crisis manager.
*   **Financial Impact Analysis:** The system calculates potential **Revenue Loss** for cancelled operations based on procedure types (e.g., TEP > Hernie).
*   **Efficiency Metrics:**
    *   **Revenue Protected:** Prioritizes moving high-value surgeries to available slots.
    *   **Cluster Bonus:** actively suggests moving surgeries to rooms performing the *same department's* procedures to save on cleaning/turnover time.
*   **Empty Room Utilization:** It suggests opening an empty room only if there is enough staff to cover it safely.

### 7. 📺 Public View (TV Mode)
A read-only, auto-refreshing dashboard designed for large monitors in the OR hallway.
*   Access via `/view` or the "Monitor" icon.
*   Shows the current live plan.
*   Refreshes every 30 seconds automatically.
*   Hides sensitive controls (Edit/Delete).

### 8. 🤖 AI Assistant (Gemini 2.5)
Integrated Chatbot to answer natural language queries about the plan.
*   *"Who is available for Room 1?"*
*   *"Are there any conflicts today?"*
*   *"Generate a handover summary."*

### 9. 📢 Notification System (SMS)
Automated communication flow to keep staff informed.
*   **Batch Publishing:** Send personalized SMS to every staff member assigned for the day with their Room, Role, and Start Time.
*   **Individual Alerts:** Notify specific staff members about spontaneous changes directly from their card.
*   **Twilio Integration:** Uses industry-standard gateway for reliable delivery.

---

## 💾 Data & Persistence

The app uses a **Hybrid Storage Strategy**:
1.  **Cloud (MongoDB):** Primary storage. Allows syncing data between different devices (e.g., Manager PC and Hallway TV).
2.  **Local (LocalStorage):** Fallback. If the internet disconnects, the app continues to work fully offline and saves data to the browser.

---

## 🚀 Installation & Setup

1.  **Clone & Install**
    ```bash
    git clone [repo-url]
    cd or-staff-planner
    npm install
    ```

2.  **Configuration**
    Create a `.env` file based on your setup.
    ```env
    MONGODB_URI=mongodb+srv://...
    GEMINI_API_KEY=...
    JWT_SECRET=...
    # Optional: For SMS Notifications
    TWILIO_ACCOUNT_SID=...
    TWILIO_AUTH_TOKEN=...
    TWILIO_PHONE_NUMBER=...
    ```

3.  **Run Locally**
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173`.

4.  **Build for Production**
    ```bash
    npm run build
    ```

---
© 2025 ORaigent GmbH - Klinikum Gütersloh Edition
