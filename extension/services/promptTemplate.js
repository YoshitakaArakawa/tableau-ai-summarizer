const PROMPT_TEMPLATE_ENDPOINT = 'prompts/base-summary.xml';
const SUMMARY_PLACEHOLDER = 'SUMMARY_XML';
const SETTINGS_PLACEHOLDER = 'SETTINGS_XML';

let promptTemplate = null;
let promptTemplatePromise = null;

function substitutePlaceholder(template, key, value) {
  const pattern = new RegExp('\\{\\{' + key + '\\}\\}', 'g');
  return template.replace(pattern, value);
}

function exposePromptUtilities(template) {
  if (typeof window !== 'undefined') {
    window.llmPromptTemplate = template;
    window.buildSummaryPromptPayload = buildPromptPayload;
  }
}

function applyPromptTemplate(templateText) {
  if (!templateText || !templateText.trim()) {
    throw new Error('Prompt template content is empty.');
  }

  promptTemplate = templateText.trim();
  exposePromptUtilities(promptTemplate);
  return promptTemplate;
}

function loadPromptTemplate() {
  if (typeof fetch !== 'function') {
    return Promise.reject(new Error('Fetch API unavailable to retrieve prompt template.'));
  }

  return fetch(PROMPT_TEMPLATE_ENDPOINT, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch prompt template: ${response.status}`);
      }
      return response.text();
    })
    .then((xml) => applyPromptTemplate(xml));
}

export function ensurePromptTemplateLoaded() {
  if (promptTemplate) {
    return Promise.resolve(promptTemplate);
  }

  if (!promptTemplatePromise) {
    promptTemplatePromise = loadPromptTemplate()
      .then((template) => {
        promptTemplatePromise = null;
        return template;
      })
      .catch((error) => {
        promptTemplatePromise = null;
        throw error;
      });
  }

  return promptTemplatePromise;
}

export function getPromptTemplate() {
  if (!promptTemplate) {
    throw new Error('Prompt template has not been loaded yet.');
  }

  return promptTemplate;
}

export function buildPromptPayload({ summaryXml, settingsXml } = {}) {
  if (!summaryXml || !summaryXml.trim()) {
    throw new Error('Summary XML is required to build the LLM prompt payload.');
  }

  if (!settingsXml || !settingsXml.trim()) {
    throw new Error('Settings XML is required to build the LLM prompt payload.');
  }

  const template = getPromptTemplate();

  return substitutePlaceholder(
    substitutePlaceholder(template, SUMMARY_PLACEHOLDER, summaryXml.trim()),
    SETTINGS_PLACEHOLDER,
    settingsXml.trim()
  );
}

