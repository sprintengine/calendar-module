import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { ActionContext, IpcInvokeHandler, MainHost, ModuleWorkspaceView } from '@sprintengine/module-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { registerMain, resolveWorkspaceRoot, runScheduledAction, toCalendarRuns } from './main'
import {
  CH_CREATE_BACKLOG_ITEM,
  CH_RUNS,
  CH_SCHEDULE,
  CH_UNSCHEDULE,
  type CalendarEvent,
  type RunsResponse,
} from './types'

type FakeHost = {
  host: MainHost
  invoke(channel: string, payload?: unknown): Promise<unknown>
  automations: { create: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> }
  conversations: { list: ReturnType<typeof vi.fn>; watch: ReturnType<typeof vi.fn> }
  startup(): Promise<void>
  emitted: string[]
}

function fakeHost(workspaces: Record<string, ModuleWorkspaceView | null>, supported = ['conversations']): FakeHost {
  const handlers = new Map<string, IpcInvokeHandler>()
  const startupHooks: Array<() => void | Promise<void>> = []
  const emitted: string[] = []
  const automations = {
    create: vi.fn(async (_moduleId: string, input: { workspaceRoot: string; draft: unknown }) => ({
      ok: true,
      automation: { id: `auto-${input.workspaceRoot.length}` },
    })),
    delete: vi.fn(async () => ({ ok: true })),
  }
  const conversations = {
    list: vi.fn(() => [
      { workspaceId: 'ws-auto', agentId: 'a1', sessionId: 's1', name: 'Calendar: Standup', cli: 'claude', providerId: 'p', modelId: 'm', status: 'active' },
      { workspaceId: 'ws-auto', agentId: 'a2', sessionId: null, name: 'Calendar: Done', cli: 'claude', providerId: 'p', modelId: 'm', status: 'absent' },
    ]),
    watch: vi.fn((_moduleId: string, _filter: unknown, _cb: unknown) => () => undefined),
  }
  const services: Record<string, unknown> = {
    'core.workspace-context': {
      get: async (id: string) => workspaces[id] ?? null,
      list: async () => Object.values(workspaces).filter(Boolean),
    },
    'automations.module-service': automations,
    'automations.provider-registry': { registerActionProvider: () => 'calendar.run-scheduled' },
    'core.module-storage': { get: async () => ({ ok: true, found: false, value: undefined }), set: async () => ({ ok: true }) },
    'conversation.module-service': conversations,
  }
  const host = {
    moduleId: 'calendar',
    hostApiVersion: 1,
    supports: (capability: string) => supported.includes(capability),
    registerIpc: (channel: string, handler: IpcInvokeHandler) => handlers.set(channel, handler),
    requireService: (token: { key: string }) => {
      const service = services[token.key]
      if (!service) throw new Error(`no service ${token.key}`)
      return service
    },
    onStartup: (hook: () => void | Promise<void>) => startupHooks.push(hook),
    onShutdown: () => undefined,
    emit: (topic: string) => emitted.push(topic),
  } as unknown as MainHost
  registerMain(host)
  return {
    host,
    automations,
    conversations,
    emitted,
    invoke: async (channel, payload) => {
      const handler = handlers.get(channel)
      if (!handler) throw new Error(`unregistered ${channel}`)
      return handler({} as never, payload)
    },
    startup: async () => {
      for (const hook of startupHooks) await hook()
    },
  }
}

const view = (id: string, folderPath: string | null): ModuleWorkspaceView =>
  ({ id, name: id, folderPath, mode: 'calendar' }) as ModuleWorkspaceView

const event = (patch: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'ev-1',
  title: 'Standup',
  kind: 'automation',
  start: '2026-10-01T09:30',
  durationMinutes: 30,
  createdAt: '2026-09-29T10:00',
  updatedAt: '2026-09-29T10:00',
  ...patch,
})

describe('workspace root resolution', () => {
  it('resolves the folder from the workspace id', async () => {
    const { host } = fakeHost({ ws: view('ws', '/projects/app') })
    await expect(resolveWorkspaceRoot(host, 'ws')).resolves.toBe('/projects/app')
  })

  it('refuses an unresolvable or folderless workspace', async () => {
    const { host } = fakeHost({ bare: view('bare', null) })
    await expect(resolveWorkspaceRoot(host, 'missing')).rejects.toThrow(/not resolvable yet/)
    await expect(resolveWorkspaceRoot(host, 'bare')).rejects.toThrow(/has no folder/)
  })

  it('schedules into the resolved folder and ignores a renderer-supplied root', async () => {
    const fake = fakeHost({ ws: view('ws', '/projects/app') })
    await fake.invoke(CH_SCHEDULE, { workspaceId: 'ws', workspaceRoot: '/etc', event: event() })
    expect(fake.automations.create).toHaveBeenCalledTimes(1)
    expect(fake.automations.create.mock.calls[0]![1].workspaceRoot).toBe('/projects/app')
  })

  it('refuses to schedule without a workspace id', async () => {
    const fake = fakeHost({ ws: view('ws', '/projects/app') })
    await expect(fake.invoke(CH_SCHEDULE, { workspaceRoot: '/projects/app', event: event() })).rejects.toThrow(
      /requires a workspaceId/,
    )
    expect(fake.automations.create).not.toHaveBeenCalled()
  })

  it('unschedules in the resolved folder', async () => {
    const fake = fakeHost({ ws: view('ws', '/projects/app') })
    await fake.invoke(CH_UNSCHEDULE, { workspaceId: 'ws', workspaceRoot: '/elsewhere', automationId: 'auto-1' })
    expect(fake.automations.delete.mock.calls[0]![1]).toEqual({ workspaceRoot: '/projects/app', automationId: 'auto-1' })
  })

  describe('backlog items', () => {
    let root: string
    beforeEach(() => {
      root = mkdtempSync(join(tmpdir(), 'calendar-test-'))
    })
    afterEach(() => rmSync(root, { recursive: true, force: true }))

    it('writes the item under the resolved folder, never a renderer-supplied one', async () => {
      const other = mkdtempSync(join(tmpdir(), 'calendar-other-'))
      try {
        const fake = fakeHost({ ws: view('ws', root) })
        const created = (await fake.invoke(CH_CREATE_BACKLOG_ITEM, {
          workspaceId: 'ws',
          workspaceRoot: other,
          title: 'Write the report',
          description: 'By Friday.',
        })) as { path: string; relativePath: string }
        expect(created.path.startsWith(root)).toBe(true)
        expect(created.relativePath).toMatch(/^backlog\/\d{4}-\d{2}-\d{2}-write-the-report\.md$/)
        expect(readFileSync(created.path, 'utf8')).toContain('# Write the report')
      } finally {
        rmSync(other, { recursive: true, force: true })
      }
    })

    it('refuses a folderless workspace', async () => {
      const fake = fakeHost({ bare: view('bare', null) })
      await expect(fake.invoke(CH_CREATE_BACKLOG_ITEM, { workspaceId: 'bare', title: 'x' })).rejects.toThrow(
        /has no folder/,
      )
    })
  })
})

describe('scheduling', () => {
  it('records the run config with an explicit permission preset, none by default', async () => {
    const fake = fakeHost({ ws: view('ws', '/projects/app') })
    await fake.invoke(CH_SCHEDULE, { workspaceId: 'ws', event: event({ cli: 'codex', cliModel: 'gpt-5' }) })
    const draft = fake.automations.create.mock.calls[0]![1].draft
    expect(draft.trigger.config.cadence).toEqual({ type: 'at', datetime: '2026-10-01T09:30' })
    expect(draft.action).toMatchObject({
      kind: 'calendar.run-scheduled',
      config: { eventId: 'ev-1', permissionPreset: 'none', cli: 'codex', cliModel: 'gpt-5' },
    })
  })

  it('keeps the bypass preset only when the event chose it', async () => {
    const fake = fakeHost({ ws: view('ws', '/projects/app') })
    await fake.invoke(CH_SCHEDULE, { workspaceId: 'ws', event: event({ permissionPreset: 'bypass', repeat: 'daily' }) })
    const draft = fake.automations.create.mock.calls[0]![1].draft
    expect(draft.action.config.permissionPreset).toBe('bypass')
    expect(draft.trigger.config.cadence).toEqual({ type: 'daily', timeLocal: '09:30' })
  })

  function actionContext(): ActionContext & { spawnAgent: ReturnType<typeof vi.fn> } {
    return {
      automationId: 'auto-1',
      runId: 'run-1',
      workspaceRoot: '/projects/app',
      triggerPayload: {},
      spawnAgent: vi.fn(async () => ({ workspaceId: 'ws-auto', agentId: 'agent-1', sessionId: 'session-1' })),
      runCommand: async () => ({ code: 0, output: '' }),
      reportProgress: () => undefined,
      requireIntegration: () => undefined,
    }
  }

  it('launches the run as a chat with the recorded preset and model, and stays running', async () => {
    const ctx = actionContext()
    const result = await runScheduledAction.run(
      { prompt: 'Do it', cli: 'codex', cliModel: 'gpt-5', permissionPreset: 'bypass', eventTitle: 'Standup' },
      ctx,
    )
    expect(ctx.spawnAgent).toHaveBeenCalledWith({
      folderPath: '/projects/app',
      prompt: 'Do it',
      permissionPreset: 'bypass',
      cli: 'codex',
      model: 'gpt-5',
      name: 'Calendar: Standup',
    })
    expect(result).toMatchObject({ status: 'running', agentId: 'agent-1', sessionId: 'session-1' })
  })

  it('passes none for a run recorded before presets existed', async () => {
    const ctx = actionContext()
    await runScheduledAction.run({ prompt: 'Do it' }, ctx)
    expect(ctx.spawnAgent.mock.calls[0]![0].permissionPreset).toBe('none')
  })

  it('fails a run with no prompt without launching', async () => {
    const ctx = actionContext()
    await expect(runScheduledAction.run({}, ctx)).resolves.toMatchObject({ status: 'failed' })
    expect(ctx.spawnAgent).not.toHaveBeenCalled()
  })
})

describe('run readout', () => {
  it('lists the live chats the module started', async () => {
    const fake = fakeHost({})
    const response = (await fake.invoke(CH_RUNS)) as RunsResponse
    expect(response).toEqual({
      available: true,
      runs: [{ workspaceId: 'ws-auto', agentId: 'a1', name: 'Calendar: Standup', status: 'active' }],
    })
  })

  it('watches once and signals the renderer on change', async () => {
    const fake = fakeHost({})
    await fake.startup()
    await fake.invoke(CH_RUNS)
    expect(fake.conversations.watch).toHaveBeenCalledTimes(1)
    const cb = fake.conversations.watch.mock.calls[0]![2] as (list: unknown[]) => void
    cb([])
    expect(fake.emitted).toEqual(['runs-changed'])
  })

  it('reports unavailable when the host has no conversations', async () => {
    const fake = fakeHost({}, [])
    await fake.startup()
    expect(await fake.invoke(CH_RUNS)).toEqual({ available: false, runs: [] })
    expect(fake.conversations.watch).not.toHaveBeenCalled()
  })

  it('keeps only conversations still starting, working or waiting on the user', () => {
    const summary = (agentId: string, status: string) =>
      ({ workspaceId: 'w', agentId, sessionId: null, name: agentId, cli: 'c', providerId: 'p', modelId: 'm', status }) as never
    const runs = toCalendarRuns(
      ['starting', 'ready', 'active', 'awaiting_approval', 'stopped', 'failed', 'absent'].map((status) =>
        summary(status, status),
      ),
    )
    expect(runs.map((run) => run.agentId)).toEqual(['starting', 'ready', 'active', 'awaiting_approval'])
  })
})
