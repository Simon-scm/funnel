# Funnel

Funnel is a minimal browser extension that summarizes the current webpage using an AI provider configured by the user.

The extension follows a **Bring Your Own Key (BYOK)** approach: users provide their own API key for the AI provider they want to use. Funnel does not operate its own backend server and does not process page content, API keys, or summaries on its own servers.

## Features

- Summarizes the currently active webpage
- Extracts and cleans visible page content
- Runs only when the user opens and triggers the extension
- Stores the selected provider, model, and API key locally in the browser
- Uses the user's own API key to send requests directly to the selected AI provider
- No backend server
- No tracking
- No analytics
- No browsing history collection

## Current Status

- Chrome Extension Manifest V3 setup
- Sidepanel UI
- Page content extraction
- Text cleanup / normalization
- Local settings storage
- OpenAI, Anthropic Claude and Google Gemini API integration via BYOK

## How It Works

Funnel uses a simple local pipeline:

```text
User opens the extension
→ Extension checks local settings
→ On button click the current page content is extracted
→ Text is cleaned and shortened
→ Request is sent directly to the selected AI provider
→ Summary is displayed in the sidepanel
```

## Privacy

Funnel is designed to minimize data collection.

- API keys are stored locally in Chrome extension storage.
- Page content is only extracted when the user intentionally opens and triggers the extension.
- Summarization requests are sent directly from the browser to the selected AI provider.
- No collection of user data.
- No server for processing summaries.

See the full [Privacy Policy](./PRIVACY.md).

## Installation guide

1. Clone this repository:

```bash
git clone https://github.com/Simon-scm/funnel.git
```

2. Open Chrome and go to:

```text
chrome://extensions
```

3. Enable **Developer mode**.

4. Click **Load unpacked**.

5. Select the project folder.

6. Open a normal webpage and click the Funnel extension icon.

## Project Structure

```text
funnel/
├── manifest.json
├── sidepanel.html
├── scripts/
│   ├── ai-providers.js
│   ├── background.js
│   └── sidepanel.js
├── styles/
│   └── sidepanel.css
├── images/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── README.md
└── PRIVACY.md
```

## Manifest Permissions

Funnel uses the following Chrome extension permissions:

### `activeTab`

Used to access the currently active webpage after the user opens or triggers the extension.

### `scripting`

Used to execute a content extraction script on the active page.

### `tabs`

Used to identify the currently active tab.

### `storage`

Used to store the user's selected provider, model, and API key locally in the browser.

### Host Permissions

Host permissions are used to send summarization requests directly to the selected AI provider.

Example:

```json
"host_permissions": [
  "https://api.openai.com/*"
]
```

Only providers that are actually supported should be listed in the manifest.

## API Keys

Funnel uses a Bring Your Own Key model.

That means:

- The user provides their own API key.
- The key is stored locally in the browser.
- The key is used only to authenticate requests to the selected AI provider.
Users are responsible for managing their own API keys and usage costs with their selected AI provider.

## Development Notes

This MVP currently uses plain HTML, CSS, and JavaScript without a build step.

## Security Notes

For BYOK usage, API keys should only be entered by the user through the extension settings and stored locally through Chrome extension storage.

## Disclaimer

Funnel is an independent project and is not affiliated with OpenAI, Google, Anthropic, or any other AI provider.

AI-generated summaries may be incomplete or inaccurate. Users should verify important information from the original source.

## License

This project is currently not licensed.
