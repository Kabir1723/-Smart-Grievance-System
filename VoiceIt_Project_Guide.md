# VoiceIt - Project Guide & Conversation Summary
**Date:** April 27, 2026

## 1. Current Project Status
- **General State:** The Smart Public Grievance Escalation System has been rebranded to **VoiceIt**. It's a full-stack application built with a Node.js backend and React frontend. 
- **Recent Updates:** The most recent commits focus on a premium UI redesign, a new landing page, an authentication modal, and a soft deletion feature for resolved complaints.
- **Uncommitted Changes:** There is currently active work in `frontend/src/pages/Dashboard.js` and `Home.js`. Also, numerous old setup README files were deleted recently.
- **Running the App:** Use the `START_PROJECT.bat` to automatically launch the frontend on port 3000 and the backend on port 5000.  (Admin credentials: `admin@grievance.com` / `admin123`).

## 2. Elevator Pitch (How to explain to other students)
**The Problem:** Normal civic grievance processes are slow, lack transparency, and people are left in the dark.
**The Solution:** VoiceIt, a modern intelligent web platform.

* **The Citizen Experience:** Citizens log in via an intuitive React portal, enter a description of their grievance, set the category (i.e. 'Road Safety'), attach evidence (photos/files), and submit.
* **The AI Brain & Auto-Routing:** Instead of human sorting, the Node.js backend automatically processes the complaint, assigns it a priority badge (Low to Critical) based on its details, and automatically routes it to the specific assigned government officer.
* **The Dashboard:** Officers log into an admin dashboard that lists issues queued by priority. Metrics, analytics, and status updates are tracked efficiently within this interface.
* **Notifications:** The system immediately pings the user whenever there is an update (viewed, in progress, or resolved). This holds the authorities accountable to the citizens in real-time!

## 3. How to Deploy on a New PC (Pendrive Transfer)
If you move this project to a completely fresh computer via pendrive, do NOT just double-click the Start script over there. The following must be done:

### Prerequisites installed on the new PC
1. **Node.js**: Required to execute JavaScript (Backend/Frontend). Download the LTS version from nodejs.org.
2. **XAMPP (MySQL)**: Required to host the local database. Download from apachefriends.org. Open XAMPP and click "Start" next to MySQL.
3. **VS Code**: Preferred IDE for opening the code project.

### Running it the very first time on a new PC
The code dependencies (`node_modules`) inside your pendrive should not be relied upon across different computers. You should download fresh dependencies before doing anything else.

1. Open XAMPP and start MySQL.
2. Open terminal in the `backend-node` folder and run: `npm install`
3. Open terminal in the `frontend` folder and run: `npm install`
4. Use the `START_PROJECT.bat` to verify if it is running correctly. 
*(If the database tables aren't automatically generated when the server starts, you may need to open the backend-node terminal and run `node reset_db.js` just once to force-create the schema).*
