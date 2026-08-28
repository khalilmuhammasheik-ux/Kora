// server.js
// KORA's brain. Talks to Gemini, decides when a tool is needed,
// and NEVER executes a tool without the frontend confirming the user approved it.

import express from "express";
import cors from "cors";
import "dotenv/config";
import { toolSchemas, executeTool } from "./tools.js";

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_INSTRUCTION = `You are KORA, a fast, capable personal AI assistant.
You can chat normally, and you can also take real actions using tools (saving notes,
setting reminders, searching the web). Only call a tool when the user's request actually
requires it. Be direct and concise. Never claim to have done something unless a tool result
confirms it.`;

function toGeminiContents(history) {
  return history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: m.functionResponse
      ? [{ functionResponse: m.functionResponse }]
      : m.functionCall
      ? [{ functionCall: m.functionCall, ...(m.thoughtSignature ? { thoughtSignature: m.thoughtSignature } : {}) }]
      : [{ text: m.text }],
  }));
}

async function callGemini(history) {
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: toGeminiContents(history),
    tools: [{ functionDeclarations: toolSchemas }],
  };

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  const functionCallPart = parts.find((p) => p.functionCall);
  if (functionCallPart) {
    return {
      type: "tool_request",
      functionCall: functionCallPart.functionCall,
      thoughtSignature: functionCallPart.thoughtSignature || null,
    };
  }

  const textPart = parts.find((p) => p.text);
  return { type: "message", text: textPart?.text || "(no response)" };
}

app.post("/chat", async (req, res) => {
  try {
    const { history } = req.body;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Server is missing GEMINI_API_KEY. See backend/.env.example." });
    }

    const result = await callGemini(history);

    if (result.type === "tool_request") {
      return res.json({
        type: "permission_request",
        tool: result.functionCall.name,
        args: result.functionCall.args,
        thoughtSignature: result.thoughtSignature,
      });
    }

    return res.json({ type: "message", text: result.text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/confirm", async (req, res) => {
  try {
    const { history, tool, args, approved, thoughtSignature } = req.body;

    let toolResultPayload;

    if (approved) {
      toolResultPayload = await executeTool(tool, args);
    } else {
      toolResultPayload = { ok: false, error: "User denied permission for this action." };
    }

    const updatedHistory = [
      ...history,
      { role: "assistant", functionCall: { name: tool, args }, thoughtSignature },
      { role: "user", functionResponse: { name: tool, response: toolResultPayload } },
    ];

    const result = await callGemini(updatedHistory);

    if (result.type === "tool_request") {
      return res.json({
        type: "permission_request",
        tool: result.functionCall.name,
        args: result.functionCall.args,
        thoughtSignature: result.thoughtSignature,
        historyForNext: updatedHistory,
      });
    }

    res.json({ type: "message", text: result.text, historyForNext: updatedHistory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`KORA backend running on port ${PORT}`));
