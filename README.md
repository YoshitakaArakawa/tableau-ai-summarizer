# Tableau AI Summarizer

A Tableau worksheet extension that captures summary data, sends it to the OpenAI Responses API (Code Interpreter tool), and writes the generated executive summary back into the dashboard. The project contains:

- A browser client (`extension/`) that runs inside Tableau Desktop and orchestrates summary generation.
- A local Node.js server (`scripts/server.js`) that exposes `/runtime-config.json` and `/api/llm/summary` endpoints.
- Reference docs and manifests for packaging the extension into a `.trex` file.

## Prerequisites

- Tableau Desktop 2021.4 or later with Extensions enabled (Extensions feature is bundled with Tableau; no separate SDK install required).
- Node.js 18+ (the project currently runs on Node 22.17). Install dependencies with `npm install`.
- An OpenAI API key with access to the Responses API + Code Interpreter tool.

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/YoshitakaArakawa/tableau-ai-summarizer
   cd tableau-ai-summarizer
   ```

2. **Configure environment variables**
   - Copy `.env_template` to `.env` and fill in the values.
   - At minimum set `OPENAI_API_KEY` and `OPENAI_MODEL` (e.g. `gpt-4.1` or `gpt-4o-mini`).
   - Tip: if you do not want to send `reasoning.effort`, leave `OPENAI_MODEL_REASONING_EFFORT` blank.

3. **Run the extension server**
   ```bash
   npm install
   npm start
   ```
   By default the server listens on port `8787` (configurable via `EXTENSION_PORT`).
   - Static files under `extension/` are served at `http://localhost:8787/index.html`.
   - The summary endpoint lives at `http://localhost:8787/api/llm/summary`.
   - Logs are written exclusively to `logs/server.log` when `LOG_TO_FILE=true`.

4. **Install the extension in Tableau Desktop**
   - Open Tableau Desktop and connect to your data source.
   - Add the extension using a customized copy of sample.trex_template with the correct host/port (don’t forget to set the extension to .trex).

5. **Generate a summary**
   - Drop a measure on the 'Measure' encoding and a date field on the 'Date' encoding.
   - Use *Format Extension* to adjust options (period/additive/trend).
   - Use *Regenerate Summary* to rerun the call on demand, or *Stop* to cancel an in-flight request.
   - The generated text appears in the extension area after the OpenAI call completes.\r\n## Environment Variables

| Variable | Description |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API key used by the Node server. |
| `OPENAI_MODEL` | Responses API model name (`gpt-4o`, `gpt-4.1`, etc.). |
| `OPENAI_MODEL_REASONING_EFFORT` | Optional reasoning effort for reasoning models (`medium`/`high`). Leave blank for compatibility with Code Interpreter. |
| `OPENAI_MODEL_VERBOSITY` | Optional verbosity flag (`low`, `medium`, `high`). |
| `LOG_TO_FILE` | `true` to log to `logs/server.log`; otherwise logs go to stdout. |
| `EXTENSION_PORT` | Port used by the local Express server (default `8787`). Ensure this matches the port embedded in your `.trex` file (e.g., `sample.trex_template`). |

## Logging & Monitoring

- Runtime logs: `logs/server.log`
- Tableau Desktop console output appears in `My Tableau Repository/Logs/log.txt`.
- When `LOG_TO_FILE=true`, the server writes exclusively to the log file, so disable any extra `console.log` in production.

## Usage Tips

- Add the date field as a **continuous** (green) dimension so Tableau passes usable summary data to the extension.
- To analyze additional dimensions (similar to Tableau Pulse breakouts), drop those fields onto the **Detail** shelf of the extension marks card before triggering the summary.

## Development Notes

- Main client entry point: `extension/main.js`
- Prompt template: `extension/prompts/base-summary.xml`
- Server summary handler: `scripts/services/summaryService.js`
- Summary responses rely on OpenAI's Code Interpreter tool. When using reasoning models, ensure the chosen model/tool combination is supported.

## License

This project is licensed under the MIT License (see [LICENSE](./LICENSE)).




