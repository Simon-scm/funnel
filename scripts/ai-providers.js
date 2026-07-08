export const DEFAULT_MODELS = {
  openai: "gpt-4.1-mini",
  gemini: "gemini-2.5-flash",
  anthropic: "claude-sonnet-4-5"
};

export async function summarizeText(text, settings) {
  if (settings.provider === "openai") {
    return summarizeWithOpenAI(text, settings);
  }

  if (settings.provider === "gemini") {
    return summarizeWithGemini(text, settings);
  }

  if (settings.provider === "anthropic") {
    return summarizeWithAnthropic(text, settings);
  }

  throw new Error(`Unknown provider: ${settings.provider}`);
}

function buildSummaryPrompts(text) {
  const systemPrompt = `
You are a precise webpage summarization assistant.

Summarize the extracted webpage content so the user can quickly understand what the page is about.

Rules:
- Use only the provided content.
- Do not invent facts, claims, names, numbers, or conclusions.
- Ignore navigation menus, cookie banners, ads, repeated UI text, newsletter prompts, and unrelated boilerplate.
- Focus on the main topic, key points, important details, and actionable information.
- If the content is mostly empty, noisy, or not enough to summarize, say that clearly.
- Write in the same language as the provided content.
- Keep the answer concise.

Output format:
1. Start with a one-sentence overview.
2. Then provide 3-7 bullet points with the most important information.
`.trim();

  const userPrompt = `
Here is extracted text from a webpage. It may contain navigation, ads, cookie banners, or repeated UI text.

Please summarize the meaningful page content.

Webpage content:
${text}
`.trim();

  return {
    systemPrompt,
    userPrompt
  };
}

async function summarizeWithOpenAI(text, settings) {
  const { systemPrompt, userPrompt } = buildSummaryPrompts(text);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const summary = extractOpenAIText(data);

  if (!summary) {
    return "No summary returned.";
  }

  return summary;
}

async function summarizeWithGemini(text, settings) {
  const { systemPrompt, userPrompt } = buildSummaryPrompts(text);
  const model = settings.model.startsWith("models/") ? settings.model : `models/${settings.model}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: systemPrompt
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: userPrompt
            }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 900
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (data.promptFeedback && data.promptFeedback.blockReason) {
    throw new Error(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
  }

  const summary = (data.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => typeof part.text === "string" ? part.text : "")
    .filter(Boolean)
    .join("\n")
    .trim();

  return summary || "No summary returned.";
}

async function summarizeWithAnthropic(text, settings) {
  const { systemPrompt, userPrompt } = buildSummaryPrompts(text);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 900,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const summary = (data.content || [])
    .map((contentItem) => {
      if (contentItem.type === "text" && typeof contentItem.text === "string") {
        return contentItem.text;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();

  return summary || "No summary returned.";
}

function extractOpenAIText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data.output)) {
    return "";
  }

  return data.output
    .flatMap((outputItem) => outputItem.content || [])
    .map((contentItem) => {
      if (typeof contentItem.text === "string") {
        return contentItem.text;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}