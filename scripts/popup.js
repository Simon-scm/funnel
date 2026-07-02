const SETTINGS_KEY = "funnelSettings";
const LAST_SUMMARY_KEY = "funnelLastSummary";

const DEFAULT_MODELS = {
  openai: "gpt-4.1-mini",
  gemini: "gemini-2.5-flash",
  anthropic: "claude-sonnet-4-5"
};

// Global UI elements
const statusText = document.querySelector("#status");

// Setup view elements
const setupView = document.querySelector("#setupView");
const providerSelect = document.querySelector("#providerSelect");
const apiKeyInput = document.querySelector("#apiKeyInput");
const modelInput = document.querySelector("#modelInput");
const saveSettingsBtn = document.querySelector("#saveSettingsBtn");

// Summary view elements
const summaryView = document.querySelector("#summaryView");
const summaryMeta = document.querySelector("#summaryMeta");
const summaryUrl = document.querySelector("#summaryUrl");
const summaryTimestamp = document.querySelector("#summaryTimestamp");
const summaryOutput = document.querySelector("#summaryOutput");
const charCount = document.querySelector("#charCount");
const summarizeBtn = document.querySelector("#summarizeBtn");
const settingsBtn = document.querySelector("#settingsBtn");
const clearSummaryBtn = document.querySelector("#clearSummaryBtn");
const clearKeyBtn = document.querySelector("#clearKeyBtn");

let currentSettings = null;
let lastSummary = null;

document.addEventListener("DOMContentLoaded", async () => {
  initializeProviderDefaults();

  currentSettings = await loadSettings();
  lastSummary = await loadLastSummary();

  if (!hasValidSettings(currentSettings)) {
    showSetupView();
    return;
  }

  fillSetupForm(currentSettings);
  showSummaryView();
});



providerSelect.addEventListener("change", () => {
  const selectedProvider = providerSelect.value;
  modelInput.value = DEFAULT_MODELS[selectedProvider] || "";
});



saveSettingsBtn.addEventListener("click", async () => {
  const provider = providerSelect.value;
  const apiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim() || DEFAULT_MODELS[provider];

  if (!provider) {
    statusText.textContent = "Select an AI provider.";
    return;
  }

  if (!apiKey) {
    statusText.textContent = "Enter an API key.";
    return;
  }

  const settings = {
    provider,
    apiKey,
    model
  };

  await saveSettings(settings);

  currentSettings = settings;

  showSummaryView();
});



summarizeBtn.addEventListener("click", async () => {
  if (!hasValidSettings(currentSettings)) {
    showSetupView();
    return;
  }

  await runSummaryFlow(currentSettings);
});


settingsBtn.addEventListener("click", () => {
  fillSetupForm(currentSettings);
  showSetupView();
});



clearSummaryBtn.addEventListener("click", async () => {
  await clearLastSummary();

  lastSummary = null;
  showSummaryView();
  statusText.textContent = "Summary cleared.";
});



clearKeyBtn.addEventListener("click", async () => {
  await clearSettings();

  currentSettings = null;
  apiKeyInput.value = "";
  summaryOutput.textContent = "";
  charCount.textContent = "0";

  showSetupView();
  statusText.textContent = "API key deleted.";
});



function initializeProviderDefaults() {
  if (!providerSelect.value) {
    providerSelect.value = "openai";
  }

  modelInput.value = DEFAULT_MODELS[providerSelect.value] || "";
}



function hasValidSettings(settings) {
  return Boolean(
    settings &&
      settings.provider &&
      settings.apiKey &&
      settings.model
  );
}



async function loadSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return data[SETTINGS_KEY] || null;
}



async function loadLastSummary() {
  const data = await chrome.storage.local.get(LAST_SUMMARY_KEY);
  return data[LAST_SUMMARY_KEY] || null;
}



async function saveSettings(settings) {
  await chrome.storage.local.set({
    [SETTINGS_KEY]: settings
  });
}



async function saveLastSummary(summary) {
  await chrome.storage.local.set({
    [LAST_SUMMARY_KEY]: summary
  });
}



async function clearLastSummary() {
  await chrome.storage.local.remove(LAST_SUMMARY_KEY);
}



async function clearSettings() {
  await chrome.storage.local.remove(SETTINGS_KEY);
}



function showSetupView() {
  setupView.hidden = false;
  summaryView.hidden = true;
  statusText.textContent = "Setup required.";
}



function showSummaryView() {
  setupView.hidden = true;
  summaryView.hidden = false;

  if (lastSummary) {
    statusText.textContent = "Last summary loaded.";
    summaryMeta.hidden = false;
    summaryUrl.textContent = lastSummary.url || "Unknown page";
    summaryTimestamp.textContent = formatTimestamp(lastSummary.createdAt);
    summaryOutput.textContent = lastSummary.text;
    charCount.textContent = String(lastSummary.charCount || 0);
    return;
  }

  summaryMeta.hidden = true;
  summaryUrl.textContent = "";
  summaryTimestamp.textContent = "";
  statusText.textContent = "Ready to summarize.";
  summaryOutput.textContent = "Click Summarize to analyze the current page.";
  charCount.textContent = "0";
}



function fillSetupForm(settings) {
  if (!settings) {
    providerSelect.value = "openai";
    modelInput.value = DEFAULT_MODELS.openai;
    apiKeyInput.value = "";
    return;
  }

  providerSelect.value = settings.provider || "openai";
  modelInput.value =
    settings.model ||
    DEFAULT_MODELS[settings.provider] ||
    "";
  apiKeyInput.value = settings.apiKey || "";
}



async function runSummaryFlow(settings) {
  setLoadingState(true);

  try {
    const pageContent = await getCurrentPageContent();
    const pageText = pageContent.text;

    charCount.textContent = String(pageText.length);

    if (!pageText) {
      summaryOutput.textContent = "No usable page content found.";
      statusText.textContent = "No content found";
      return;
    }

    const summary = await summarizeText(pageText, settings);

    lastSummary = {
      text: summary,
      charCount: pageText.length,
      url: pageContent.url,
      createdAt: new Date().toISOString()
    };
    await saveLastSummary(lastSummary);

    summaryOutput.textContent = summary;
    summaryMeta.hidden = false;
    summaryUrl.textContent = lastSummary.url || "Unknown page";
    summaryTimestamp.textContent = formatTimestamp(lastSummary.createdAt);
    statusText.textContent = "Summary created.";
  } catch (error) {
    summaryOutput.textContent = getFriendlyErrorMessage(error);
    statusText.textContent = "Could not create summary.";
  } finally {
    setLoadingState(false);
  }
}

function formatTimestamp(value) {
  if (!value) {
    return "Unknown time";
  }

  return new Date(value).toLocaleString();
}

function getFriendlyErrorMessage(error) {
  const message = error.message || "";

  if (/No active tab/i.test(message)) {
    return "Open a webpage first, then try summarizing again.";
  }

  if (/Cannot access|chrome:|Cannot script/i.test(message)) {
    return "This page cannot be analyzed by the extension. Try a regular webpage.";
  }

  if (/Failed to fetch|NetworkError|CORS/i.test(message)) {
    return "The request could not reach the selected AI provider. Check your connection and provider access.";
  }

  if (/API error (401|403)/i.test(message)) {
    return "The API key was rejected. Check the selected provider and API key.";
  }

  if (/API error 429/i.test(message)) {
    return "The provider rate limit was reached. Wait a moment and try again.";
  }

  if (/API error (400|404)/i.test(message)) {
    return "The provider rejected the request. Check that the selected model name is valid.";
  }

  if (/blocked the request/i.test(message)) {
    return "The provider blocked this page content and did not return a summary.";
  }

  return "Something went wrong while creating the summary. Check your settings and try again.";
}



async function getCurrentPageContent() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab || !tab.id) {
    throw new Error("No active tab found.");
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPageContent
  });

  return {
    text: results[0].result || "",
    url: tab.url || ""
  };
}



function extractPageContent() {
  function cleanText(text) {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/^ +| +$/gm, "")
      .replace(/\n\s+\n/g, "\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const clone = document.body.cloneNode(true);

  clone.querySelectorAll(
    "script, style, nav, footer, aside, iframe, noscript, svg, button, form"
  ).forEach((el) => el.remove());

  const main =
    clone.querySelector("article") ||
    clone.querySelector("main") ||
    clone;

  return cleanText(main.innerText).slice(0, 12000);
}



async function summarizeText(text, settings) {
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


function setLoadingState(isLoading) {
  summarizeBtn.disabled = isLoading;
  saveSettingsBtn.disabled = isLoading;

  if (isLoading) {
    statusText.textContent = "Analyzing page content...";
    summaryOutput.textContent = "Loading content...";
  }
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
