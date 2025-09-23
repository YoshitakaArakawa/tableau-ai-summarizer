if (typeof window !== 'undefined') {
  window.llmModelConfig = null;
}

const RUNTIME_CONFIG_ENDPOINT = 'runtime-config.json';

let modelConfig = null;
let modelConfigPromise = null;

function publishModelConfig() {
  if (typeof window !== 'undefined') {
    window.llmModelConfig = modelConfig ? JSON.parse(JSON.stringify(modelConfig)) : null;
  }
}

function validateModelConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Runtime model config is missing or invalid.');
  }

  if (!config.model) {
    throw new Error('Runtime model config must include a model identifier.');
  }
}

function applyModelConfig(config) {
  validateModelConfig(config);

  const settings = config.modelSettings || {};
  const reasoning = settings.reasoning || {};

  modelConfig = {
    model: config.model,
    modelSettings: {
      verbosity: settings.verbosity === undefined || settings.verbosity === null ? null : settings.verbosity,
      reasoning: {
        effort: reasoning.effort === undefined || reasoning.effort === null ? null : reasoning.effort
      }
    }
  };

  publishModelConfig();
  return modelConfig;
}

function loadModelConfig() {
  if (typeof fetch !== 'function') {
    return Promise.reject(new Error('Fetch API unavailable to retrieve runtime config.'));
  }

  return fetch(RUNTIME_CONFIG_ENDPOINT, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch runtime config: ${response.status}`);
      }
      return response.json();
    })
    .then((config) => applyModelConfig(config));
}

export function ensureModelConfigLoaded() {
  if (modelConfig) {
    return Promise.resolve(modelConfig);
  }

  if (!modelConfigPromise) {
    modelConfigPromise = loadModelConfig()
      .then((config) => {
        modelConfigPromise = null;
        return config;
      })
      .catch((error) => {
        modelConfigPromise = null;
        throw error;
      });
  }

  return modelConfigPromise;
}

export function getModelConfig() {
  return modelConfig;
}
