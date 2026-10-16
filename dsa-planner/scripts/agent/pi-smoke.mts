import { mkdir } from 'fs/promises'
import { Type } from 'typebox'
import {
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  getAgentDir,
  ModelRuntime,
  resolveCliModel,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent'

const model = process.env.PI_MODEL ?? 'kiro/claude-sonnet-5-5'
const extensions = (process.env.PI_EXTENSION_PATHS ?? '').split(',').map((path) => path.trim()).filter(Boolean)
const cwd = process.env.AGENT_WORK_DIR ?? '/tmp/dsa-planner-agent'
await mkdir(cwd, { recursive: true })

const echo = defineTool({
  name: 'echo_number', label: 'Echo', description: 'Returns the number it receives. Call it once with n = 7.',
  parameters: Type.Object({ n: Type.Integer() }),
  execute: async (_id, parameters) => ({ content: [{ type: 'text', text: `echo ${parameters.n}` }], details: {} }),
})
const fail = defineTool({
  name: 'always_fail', label: 'Fail', description: 'Always fails. Call it once after echo_number.',
  parameters: Type.Object({}), execute: async () => { throw new Error('planned failure') },
})
const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: true, maxRetries: 1 } })
const loader = new DefaultResourceLoader({
  cwd, agentDir: getAgentDir(), settingsManager, noExtensions: true, additionalExtensionPaths: extensions,
  noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
  systemPrompt: 'You are a test agent. Follow the tool descriptions exactly.',
})
await loader.reload()
const modelRuntime = await ModelRuntime.create()
const { session } = await createAgentSession({
  cwd, agentDir: getAgentDir(), modelRuntime, resourceLoader: loader, settingsManager,
  sessionManager: SessionManager.inMemory(cwd), noTools: 'builtin',
  tools: ['echo_number', 'always_fail'], customTools: [echo, fail],
})
const resolved = resolveCliModel({ cliModel: model, modelRuntime })
if (resolved.error || !resolved.model) throw new Error(`Model not found: ${resolved.error ?? model}`)
await session.setModel(resolved.model)
session.subscribe((event) => {
  if (event.type === 'tool_execution_start') process.stdout.write(`START ${event.toolName} ${JSON.stringify(event.args)}\n`)
  if (event.type === 'tool_execution_end') process.stdout.write(`END ${event.toolName} isError=${event.isError}\n`)
  if (event.type === 'message_end' && event.message.role === 'assistant') process.stdout.write(`USAGE ${JSON.stringify((event.message as { usage?: unknown }).usage)}\n`)
})
process.stdout.write(`TOOLS ${session.agent.state.tools.map((tool) => tool.name).join(',')}\n`)
await session.prompt('Run the tools as described, then say DONE.')
session.dispose()
