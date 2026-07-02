const SETTINGS_KEY = "funnelSettings";

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
const summaryOutput = document.querySelector("#summaryOutput");
const charCount = document.querySelector("#charCount");
const retryBtn = document.querySelector("#retryBtn");
const settingsBtn = document.querySelector("#settingsBtn");
const clearKeyBtn = document.querySelector("#clearKeyBtn");

let currentSettings = null;

document.addEventListener("DOMContentLoaded", async () => {
  initializeProviderDefaults();

  currentSettings = await loadSettings();

  if (!hasValidSettings(currentSettings)) {
    showSetupView();
    return;
  }

  fillSetupForm(currentSettings);
  showSummaryView();
  await runSummaryFlow(currentSettings);
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
    statusText.textContent = "Bitte KI-Anbieter auswählen.";
    return;
  }

  if (!apiKey) {
    statusText.textContent = "Bitte API-Key eingeben.";
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
  await runSummaryFlow(currentSettings);
});



retryBtn.addEventListener("click", async () => {
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



clearKeyBtn.addEventListener("click", async () => {
  await clearSettings();

  currentSettings = null;
  apiKeyInput.value = "";
  summaryOutput.textContent = "";
  charCount.textContent = "0";

  showSetupView();
  statusText.textContent = "API-Key wurde gelöscht.";
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



async function saveSettings(settings) {
  await chrome.storage.local.set({
    [SETTINGS_KEY]: settings
  });
}



async function clearSettings() {
  await chrome.storage.local.remove(SETTINGS_KEY);
}



function showSetupView() {
  setupView.hidden = false;
  summaryView.hidden = true;
  statusText.textContent = "Setup erforderlich.";
}



function showSummaryView() {
  setupView.hidden = true;
  summaryView.hidden = false;
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
    const pageText = await getCurrentPageContent();

    charCount.textContent = String(pageText.length);

    if (!pageText) {
      summaryOutput.textContent = "No usable page content found.";
      statusText.textContent = "No content found";
      return;
    }

    const summary = await summarizeText(pageText, settings);

    summaryOutput.textContent = summary;
    statusText.textContent = "Summary created.";
  } catch (error) {
    summaryOutput.textContent = `Error: ${error.message}`;
    statusText.textContent = "Error while analyzing content.";
  } finally {
    setLoadingState(false);
  }
}



async function getCurrentPageContent() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab || !tab.id) {
    throw new Error("Kein aktiver Tab gefunden.");
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractPageContent
  });

  return results[0].result || "";
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

  throw new Error(`Unbekannter Provider: ${settings.provider}`);
}



async function summarizeWithOpenAI(text, settings) {
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
2. Then provide 3–7 bullet points with the most important information.
`.trim();

  const userPrompt = `
Here is extracted text from a webpage. It may contain navigation, ads, cookie banners, or repeated UI text.

Please summarize the meaningful page content.

Webpage content:
${text}
`.trim();

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
  })

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  console.log("OpenAI response:", data);

  const summary = extractOpenAIText(data);

  if (!summary) {
    return "No summary returned.";
  }

  return summary;
}



async function summarizeWithGemini(text, settings) {
  return [
    "Gemini Dummy Summary",
    "",
    `Provider: Google Gemini`,
    `Model: ${settings.model}`,
    `Extrahierte Zeichen: ${text.length}`,
    "",
    "Hier wird später die echte Gemini-Zusammenfassung stehen."
  ].join("\n");
}



async function summarizeWithAnthropic(text, settings) {
  return [
    "Claude Dummy Summary",
    "",
    `Provider: Anthropic Claude`,
    `Model: ${settings.model}`,
    `Extrahierte Zeichen: ${text.length}`,
    "",
    "Hier wird später die echte Claude-Zusammenfassung stehen."
  ].join("\n");
}



function setLoadingState(isLoading) {
  retryBtn.disabled = isLoading;
  saveSettingsBtn.disabled = isLoading;

  if (isLoading) {
    statusText.textContent = "Analizing page content...";
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