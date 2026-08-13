/** 移动端初版精选模型。不拉全量 catalog，避免把付费/音频/安全分类器混进来。 */

export type ModelChoice = {
  provider: string
  model: string
  label: string
  hint: string
  group: 'pinned' | 'openrouter' | 'zen'
}

export const DEFAULT_MODEL: ModelChoice = {
  provider: 'opencode-go',
  model: 'deepseek-v4-flash',
  label: 'DeepSeek V4 Flash',
  hint: 'OpenCode Go',
  group: 'pinned',
}

export const MOBILE_MODELS: ModelChoice[] = [
  DEFAULT_MODEL,
  {
    provider: 'xai-oauth',
    model: 'grok-4.6',
    label: 'Grok 4.6',
    hint: 'xAI OAuth',
    group: 'pinned',
  },
  {
    provider: 'openrouter',
    model: 'openai/gpt-oss-20b:free',
    label: 'gpt-oss-20b',
    hint: 'OpenRouter 免费',
    group: 'openrouter',
  },
  {
    provider: 'openrouter',
    model: 'google/gemma-4-31b-it:free',
    label: 'Gemma 4 31B',
    hint: 'OpenRouter 免费',
    group: 'openrouter',
  },
  {
    provider: 'openrouter',
    model: 'google/gemma-4-26b-a4b-it:free',
    label: 'Gemma 4 26B A4B',
    hint: 'OpenRouter 免费',
    group: 'openrouter',
  },
  {
    provider: 'openrouter',
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
    label: 'Nemotron 3 Super',
    hint: 'OpenRouter 免费',
    group: 'openrouter',
  },
  {
    provider: 'openrouter',
    model: 'nvidia/nemotron-3-nano-30b-a3b:free',
    label: 'Nemotron 3 Nano',
    hint: 'OpenRouter 免费',
    group: 'openrouter',
  },
  {
    provider: 'openrouter',
    model: 'nvidia/nemotron-nano-9b-v2:free',
    label: 'Nemotron Nano 9B',
    hint: 'OpenRouter 免费',
    group: 'openrouter',
  },
  {
    provider: 'openrouter',
    model: 'poolside/laguna-s-2.1:free',
    label: 'Laguna S 2.1',
    hint: 'OpenRouter 免费',
    group: 'openrouter',
  },
  {
    provider: 'openrouter',
    model: 'cohere/north-mini-code:free',
    label: 'North Mini Code',
    hint: 'OpenRouter 免费',
    group: 'openrouter',
  },
  {
    provider: 'openrouter',
    model: 'liquid/lfm-2.5-2.6b:free',
    label: 'LFM 2.5 2.6B',
    hint: 'OpenRouter 免费',
    group: 'openrouter',
  },
  {
    provider: 'opencode-zen',
    model: 'big-pickle',
    label: 'Big Pickle',
    hint: 'OpenCode Zen 免费',
    group: 'zen',
  },
  {
    provider: 'opencode-zen',
    model: 'deepseek-v4-flash-free',
    label: 'DeepSeek V4 Flash Free',
    hint: 'OpenCode Zen 免费',
    group: 'zen',
  },
  {
    provider: 'opencode-zen',
    model: 'mimo-v2.5-free',
    label: 'MiMo V2.5 Free',
    hint: 'OpenCode Zen 免费',
    group: 'zen',
  },
  {
    provider: 'opencode-zen',
    model: 'hy3-free',
    label: 'Hy3 Free',
    hint: 'OpenCode Zen 免费',
    group: 'zen',
  },
  {
    provider: 'opencode-zen',
    model: 'laguna-s-2.1-free',
    label: 'Laguna S 2.1 Free',
    hint: 'OpenCode Zen 免费',
    group: 'zen',
  },
  {
    provider: 'opencode-zen',
    model: 'nemotron-3-ultra-free',
    label: 'Nemotron 3 Ultra Free',
    hint: 'OpenCode Zen 免费',
    group: 'zen',
  },
  {
    provider: 'opencode-zen',
    model: 'nemotron-3.5-lightning-free',
    label: 'Nemotron 3.5 Lightning',
    hint: 'OpenCode Zen 免费',
    group: 'zen',
  },
]

export const MODEL_GROUPS: Array<{ id: ModelChoice['group']; title: string }> = [
  { id: 'pinned', title: '常用' },
  { id: 'openrouter', title: 'OpenRouter 免费' },
  { id: 'zen', title: 'OpenCode Zen 免费' },
]

const PICK_KEY = 'hermes-mobile-model-pick'

export function modelKey(choice: Pick<ModelChoice, 'provider' | 'model'>): string {
  return `${choice.provider}::${choice.model}`
}

export function findModel(provider?: string | null, model?: string | null): ModelChoice | null {
  if (!model) return null
  return MOBILE_MODELS.find(m => m.model === model && (!provider || m.provider === provider))
    ?? MOBILE_MODELS.find(m => m.model === model)
    ?? null
}

export function loadSavedModel(): ModelChoice {
  try {
    const raw = localStorage.getItem(PICK_KEY)
    if (!raw) return DEFAULT_MODEL
    const parsed = JSON.parse(raw) as { provider?: string; model?: string }
    return findModel(parsed.provider, parsed.model) ?? DEFAULT_MODEL
  } catch {
    return DEFAULT_MODEL
  }
}

export function saveModelPick(choice: ModelChoice): void {
  localStorage.setItem(PICK_KEY, JSON.stringify({ provider: choice.provider, model: choice.model }))
}

export function shortModelLabel(choice: ModelChoice): string {
  return choice.label
}
