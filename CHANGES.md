# What's new in this build

## 1. AI Chatbot (Anthropic Claude)
- Floating chat widget on every page (`frontend/src/components/ChatbotWidget.js`)
- Backend endpoints in `backend-node/server.js`:
  - `POST /api/chatbot` — FAQ / guidance / department suggestions / complaint-status lookup (works for logged-out visitors too; if logged in and you mention a complaint ID, it fetches the real record so the AI never guesses)
  - `POST /api/chatbot/draft-complaint` — turns a chat conversation into a structured complaint (title/description/category/location)
  - `POST /api/chatbot/submit-complaint` — files the complaint after you confirm the draft in the widget
- **The API key is stored server-side only**, in `backend-node/.env` as `ANTHROPIC_API_KEY`. It is never sent to the browser or committed to git (`.env` is gitignored). A safe template is in `backend-node/.env.example`.
- ⚠️ **You pasted your API key directly in our chat.** I stored it in `.env` for you, but since it was shared in plaintext, please rotate/regenerate it from the Anthropic Console once you're done testing, and use the new key going forward.

## 2. New user features implemented end-to-end (backend + UI)
- Email verification on registration (`/verify-email`) + resend link
- Forgot / reset password flow (`/forgot-password`, `/reset-password`)
- Change password, edit profile, notification preferences — all on the new **Profile** page
- Edit complaint (while still Pending) and Cancel complaint (Pending/In Progress)
- Reopen a resolved/closed complaint within 7 days
- Upload images/documents to a complaint (drag a file in on Submit or from the complaint detail page); view/download attachments
- Submit feedback + star rating on resolved complaints
- Search / filter (status, category, priority) / sort on "My Complaints"
- Dark / light mode toggle (top-right button, persisted in localStorage)
- "Submit Complaint Through AI Chatbot" flow — describe the issue in chat, review the AI's draft, confirm to file it

## 3. Bugs fixed
- Removed a duplicate `path` require in `server.js`
- **Fixed hardcoded Windows paths** (`C:\Users\Administrator\Desktop\sgs 2\...`) in `START_PROJECT.bat`, `START_BACKEND.bat`, `START_FRONTEND.bat` — these now use `%~dp0` so they work from wherever you extract the project
- Added a proper error handler for file uploads (size/type limits) instead of a raw stack trace
- Frontend now builds cleanly with zero warnings/errors (`CI=true npm run build`)

## 4. Setup
```bash
# Backend
cd backend-node
cp .env.example .env      # then fill in DB credentials, email, and ANTHROPIC_API_KEY
npm install
node server.js             # creates/migrates all tables automatically on first run

# Frontend (separate terminal, for local dev with hot reload)
cd frontend
npm install
npm start
```
For a single deployable bundle, `npm run build` in `frontend/` and copy `frontend/build/*` into `backend-node/public/` (already done once in this delivered zip) — then `node server.js` alone serves both API and UI on port 5000.

## 5. Known limitation / scope note
The `backend/` folder (Python/Flask) is legacy and not wired into the app — `backend-node/` is the one actually used by the launch scripts and the frontend. I left it untouched rather than deleting it, in case you still need it for something.
