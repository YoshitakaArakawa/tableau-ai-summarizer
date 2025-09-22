const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const PORT = process.env.PULSE_VIZ_PROXY_PORT || 8787;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not set. /api/generate will return 503 responses.");
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(PUBLIC_DIR));

app.post("/api/generate", async (req, res) => {
  const { prompt, parameters, tables, model = "gpt-5.2-mini" } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  if (!OPENAI_API_KEY) {
    return res.status(503).json({ error: "OPENAI_API_KEY is not configured on the proxy" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        input: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
        metadata: {
          source: "pulse-viz-extension",
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: "OpenAI request failed",
        status: response.status,
        details: errorBody,
      });
    }

    const result = await response.json();
    const outputText = result.output_text || extractFirstText(result);

    if (!outputText) {
      return res.status(500).json({ error: "No text output received from OpenAI" });
    }

    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch (error) {
      return res.status(500).json({
        error: "Failed to parse assistant output as JSON",
        raw: outputText,
      });
    }

    return res.json(parsed);
  } catch (error) {
    console.error("OpenAI proxy error", error);
    return res.status(500).json({ error: "Unexpected proxy failure" });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Pulse Viz proxy + static server listening on http://localhost:${PORT}`);
});

function extractFirstText(result) {
  if (!result || !Array.isArray(result.output)) {
    return undefined;
  }
  for (const item of result.output) {
    if (item?.content) {
      for (const segment of item.content) {
        if (segment?.type === "text" && typeof segment.text === "string") {
          return segment.text;
        }
      }
    }
  }
  return undefined;
}
