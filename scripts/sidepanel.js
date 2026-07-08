import { DEFAULT_MODELS, summarizeText } from "./ai-providers.js";

const SETTINGS_KEY = "funnelSettings";
const LAST_SUMMARY_KEY = "funnelLastSummary";
const EMPTY_SUMMARY_TEXT = "Click Summarize to analyze the current page.";

const statusText = document.querySelector("#status");
const setupView = document.querySelector("#setupView");
const providerSelect = document.querySelector("#providerSelect");
const apiKeySavedNote = document.querySelector("#apiKeySavedNote");
const apiKeyInput = document.querySelector("#apiKeyInput");
const clearStoredKeyBtn = document.querySelector("#clearStoredKeyBtn");
const modelInput = document.querySelector("#modelInput");
const saveSettingsBtn = document.querySelector("#saveSettingsBtn");
const summaryView = document.querySelector("#summaryView");
const summaryMeta = document.querySelector("#summaryMeta");
const summaryUrl = document.querySelector("#summaryUrl");
const summaryTimestamp = document.querySelector("#summaryTimestamp");
const summaryOutput = document.querySelector("#summaryOutput");
const copySummaryBtn = document.querySelector("#copySummaryBtn");
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
  const existingApiKey = currentSettings?.apiKey || "";
  const model = modelInput.value.trim() || DEFAULT_MODELS[provider];

  if (!provider) {
    statusText.textContent = "Select an AI provider.";
    return;
  }

  if (!apiKey && !existingApiKey) {
    statusText.textContent = "Enter an API key.";
    return;
  }

  const settings = {
    provider,
    apiKey: apiKey || existingApiKey,
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

copySummaryBtn.addEventListener("click", async () => {
  const text = summaryOutput.textContent.trim();

  if (!text || text === EMPTY_SUMMARY_TEXT) {
    statusText.textContent = "No summary to copy.";
    return;
  }

  await navigator.clipboard.writeText(text);
  statusText.textContent = "Summary copied.";
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

clearStoredKeyBtn.addEventListener("click", async () => {
  await deleteApiKey();
});

clearKeyBtn.addEventListener("click", async () => {
  await deleteApiKey();
  showSetupView();
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
  summaryOutput.textContent = EMPTY_SUMMARY_TEXT;
  charCount.textContent = "0";
}

function fillSetupForm(settings) {
  if (!settings) {
    providerSelect.value = "openai";
    modelInput.value = DEFAULT_MODELS.openai;
    apiKeyInput.value = "";
    updateSavedKeyState(false);
    return;
  }

  providerSelect.value = settings.provider || "openai";
  modelInput.value =
    settings.model ||
    DEFAULT_MODELS[settings.provider] ||
    "";
  apiKeyInput.value = "";
  updateSavedKeyState(Boolean(settings.apiKey));
}

async function deleteApiKey() {
  await clearSettings();

  currentSettings = null;
  apiKeyInput.value = "";
  summaryOutput.textContent = "";
  charCount.textContent = "0";
  updateSavedKeyState(false);
  statusText.textContent = "API key deleted.";
}

function updateSavedKeyState(hasSavedKey) {
  apiKeySavedNote.hidden = !hasSavedKey;
  clearStoredKeyBtn.hidden = !hasSavedKey;
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
    showAttemptMeta(error.pageUrl, error.createdAt);
    summaryOutput.textContent = getFriendlyErrorMessage(error);
    statusText.textContent = "Could not create summary.";
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
    throw new Error("No active tab found.");
  }

  let results;

  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent
    });
  } catch (error) {
    error.pageUrl = tab.url || "";
    error.createdAt = new Date().toISOString();
    throw error;
  }

  return {
    text: results[0].result || "",
    url: tab.url || ""
  };
}

function showAttemptMeta(url, createdAt) {
  if (!url && !createdAt) {
    return;
  }

  summaryMeta.hidden = false;
  summaryUrl.textContent = url || "Unknown page";
  summaryTimestamp.textContent = formatTimestamp(createdAt);
  charCount.textContent = "0";
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

function setLoadingState(isLoading) {
  summarizeBtn.disabled = isLoading;
  saveSettingsBtn.disabled = isLoading;

  if (isLoading) {
    statusText.textContent = "Analyzing page content...";
    summaryOutput.textContent = "Loading content...";
  }
}
