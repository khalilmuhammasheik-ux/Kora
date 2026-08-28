# KORA — Personal Agentic Assistant

A chat assistant that can take real actions (save notes, set reminders, search the web)
but always asks for your permission first via the **Permission Ledger**.

## How it works

1. You send a message.
2. The backend asks Gemini what to do.
3. If Gemini wants to use a tool, it does **not** run — it shows up as a ticket in the
   Permission Ledger with an Allow / Deny button.
4. Only after you click Allow does the backend actually execute the tool.
5. The result gets fed back to Gemini, which replies to you normally.

## Project structure

```
kora/
  backend/     Node/Express server — talks to Gemini, holds the API key, runs tools
  frontend/    The chat UI (installable as an app on phone or laptop)
```

## 1. Get a free Gemini API key

Go to https://aistudio.google.com/app/apikey → create a key (no credit card needed
for the free tier).

## 2. Run the backend

```bash
cd backend
npm install
cp .env.example .env
# open .env and paste your Gemini key in
npm start
```

It should print: `KORA backend running on port 3001`

## 3. Run the frontend

The frontend is plain HTML/CSS/JS — no build step. Easiest way to test locally:

```bash
cd frontend
npx serve .
```

Open the URL it gives you. Make sure `BACKEND_URL` at the top of `script.js` points
to your backend (`http://localhost:3001` for local testing).

## 4. Add tools

Open `backend/tools.js`. Every tool has two parts:
- a **schema** (tells Gemini the tool exists and what arguments it takes)
- an **executor** (the actual code, inside the `switch` in `executeTool`)

Add both and it automatically shows up as a permission ticket when KORA wants to use it.

## 5. Deploy for free (so it works from any device)

**Backend → Render.com**
1. Push this `backend/` folder to a GitHub repo
2. Render.com → New → Web Service → connect the repo
3. Build command: `npm install` — Start command: `npm start`
4. Add environment variable `GEMINI_API_KEY` in Render's dashboard (never commit `.env`)
5. Render gives you a URL like `https://kora-backend.onrender.com`

Note: free-tier Render services sleep after inactivity — the first message after a
while may take 10–20 seconds while it wakes up. Normal for free hosting.

**Frontend → Vercel or Netlify**
1. Update `BACKEND_URL` in `script.js` to your Render URL
2. Push `frontend/` to GitHub
3. Vercel.com or Netlify.com → New Project → import the repo → deploy
4. You'll get a URL like `https://kora.vercel.app`

**Install it like an app**
Open that URL on your phone → browser menu → "Add to Home Screen." Same on
laptop Chrome → the install icon in the address bar. Same account, same data,
any device — because it all lives on the web, not on one phone.

## 6. Add icons (optional but needed for a proper home-screen icon)

Drop a 192x192 and 512x512 PNG into `frontend/` named `icon-192.png` and
`icon-512.png` — anything works, even a quick logo you generate or draw.

## What's stubbed vs real right now

- **create_note / set_reminder / list_notes** — work, but store data in memory,
  meaning it resets when the backend restarts. Swap in Supabase (free tier) for
  real persistence — ask me when you're ready for that step.
- **web_search** — uses DuckDuckGo's free Instant Answer API, which is limited.
  Fine as a placeholder; swap for a real search API later if needed.
- **Accounts / cross-device sync** — not yet built. Right now anyone with the
  URL can use it. Next real step once the above works end-to-end.
