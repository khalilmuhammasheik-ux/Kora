// server.js
// KORA's brain. Talks to Groq (OpenAI-compatible), decides when a tool is needed,
// and NEVER executes a tool without the frontend confirming the user approved it.

import express from "express";
import cors from "cors";
import "dotenv/config";
import { toolSchemas, executeTool } from "./tools.js";

const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = "openai/gpt-oss-20b";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are KORA, a fast, capable personal AI assistant.
You can chat normally, and you can also take real actions using tools (saving notes,
setting reminders, searching the web). Only call a tool when the user's request actually
requires it. Be direct and concise. Never claim to have done something unless a tool result
confirms it.`;

function toGroqMessages(history) {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  for (const m of history) {
    if (m.toolCall) {
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: m.toolCall.id,
            type: "function",
            function: { name: m.toolCall.name, arguments: JSON.stringify(m.toolCall.args) },
          },
        ],
      });
    } else if (m.toolResult) {
      messages.push({
        role: "tool",
        tool_call_id: m.toolResult.toolCallId,
        content: JSON.stringify(m.toolResult.response),
      });
    } else {
      messages.push({ role: m.role, content: m.text });
    }
  }
  return messages;
}

async function callGroq(history) {
  const body = {
    model: MODEL,
    messages: toGroqMessages(history),
    tools: toolSchemas,
  };

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const message = data.choices?.[0]?.message;

  const toolCall = message?.tool_calls?.[0];
  if (toolCall) {
    return {
      type: "tool_request",
      toolCallId: toolCall.id,
      name: toolCall.function.name,
      args: JSON.parse(toolCall.function.arguments || "{}"),
    };
  }

  return { type: "message", text: message?.content || "(no response)" };
}

app.post("/chat", async (req, res) => {
  try {
    const { history } = req.body;
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: "Server is missing GROQ_API_KEY. See backend/.env.example." });
    }

    const result = await callGroq(history);

    if (result.type === "tool_request") {
      return res.json({
        type: "permission_request",
        tool: result.name,
        args: result.args,
        toolCallId: result.toolCallId,
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
    const { history, tool, args, approved, toolCallId } = req.body;

    let toolResultPayload;
    if (approved) {
      toolResultPayload = await executeTool(tool, args);
    } else {
      toolResultPayload = { ok: false, error: "User denied permission for this action." };
    }

    const updatedHistory = [
      ...history,
      { role: "assistant", toolCall: { id: toolCallId, name: tool, args } },
      { role: "tool", toolResult: { toolCallId, response: toolResultPayload } },
    ];

    const result = await callGroq(updatedHistory);

    if (result.type === "tool_request") {
      return res.json({
        type: "permission_request",
        tool: result.name,
        args: result.args,
        toolCallId: result.toolCallId,
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
