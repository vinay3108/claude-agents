import type { AIProvider } from './AIProvider'
import { ClaudeCodeProvider } from './ClaudeCodeProvider'
import { MockAIProvider } from './MockAIProvider'
import { PiProvider } from './pi/PiProvider'
import type { EnvSource } from './pi/piConfig'

const AI_PROVIDERS = {
  claude: () => new ClaudeCodeProvider(),
  pi: () => new PiProvider(),
} as const satisfies Record<string, () => AIProvider>

type AIProviderName = keyof typeof AI_PROVIDERS

const DEFAULT_PROVIDER: AIProviderName = 'claude'

function isProviderName(name: string): name is AIProviderName {
  return Object.hasOwn(AI_PROVIDERS, name)
}

export function createAIProvider(env: EnvSource = process.env): AIProvider {
  if (env['USE_MOCK_AI'] === 'true' || env['NODE_ENV'] === 'test') {
    return new MockAIProvider()
  }

  const name = env['AI_PROVIDER']?.trim().toLowerCase() || DEFAULT_PROVIDER
  if (!isProviderName(name)) {
    throw new Error(
      `Unknown AI_PROVIDER "${name}". Use one of: ${Object.keys(AI_PROVIDERS).join(', ')}`,
    )
  }
  return AI_PROVIDERS[name]()
}
