// tools.js
// Every tool KORA can use lives here. Each tool has:
//   - a schema (so Gemini knows it exists and what args it needs)
//   - an executor (the actual code that runs ONLY after the user approves it)
//
// To add a new tool: add a schema below, add a matching case in executeTool(),
// and it will automatically show up in KORA's permission-request UI.

import { nanoid } from "nanoid";

// In-memory storage (resets when the server restarts).
// Swap this for a real database (e.g. Supabase) once you're ready to persist data.
const store = {
  notes: [],
  reminders: [],
};

export const toolSchemas = [
  {
    name: "create_note",
    description: "Save a short note or piece of information KORA should remember for the user.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title for the note" },
        content: { type: "string", description: "The note content" },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "set_reminder",
    description: "Create a reminder for the user at a specific time.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "What to remind the user about" },
        when: { type: "string", description: "When the reminder is for, in plain language (e.g. '2026-08-29 09:00')" },
      },
      required: ["text", "when"],
    },
  },
  {
    name: "web_search",
    description: "Search the web for current information the user asked about.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_notes",
    description: "Retrieve all notes previously saved for the user.",
    parameters: { type: "object", properties: {} },
  },
];

export async function executeTool(name, args) {
  switch (name) {
    case "create_note": {
      const note = { id: nanoid(8), title: args.title, content: args.content, createdAt: new Date().toISOString() };
      store.notes.push(note);
      return { ok: true, note };
    }

    case "set_reminder": {
      const reminder = { id: nanoid(8), text: args.text, when: args.when, createdAt: new Date().toISOString() };
      store.reminders.push(reminder);
      return { ok: true, reminder };
    }

    case "web_search": {
      // Free, keyless option: DuckDuckGo Instant Answer API.
      // It's limited (no full search results), so treat this as a starting point —
      // swap in a real search API (e.g. Brave Search API free tier) for better results.
      try {
        const res = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(args.query)}&format=json&no_html=1`
        );
        const data = await res.json();
        return {
          ok: true,
          summary: data.AbstractText || "No direct summary found.",
          relatedTopics: (data.RelatedTopics || []).slice(0, 3).map((t) => t.Text).filter(Boolean),
        };
      } catch (err) {
        return { ok: false, error: "Search failed: " + err.message };
      }
    }

    case "list_notes": {
      return { ok: true, notes: store.notes };
    }

    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}
