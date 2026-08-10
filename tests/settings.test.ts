import { beforeEach, describe, expect, it } from 'vitest'

import {
	DEFAULT_SETTINGS,
	deleteEndpoint,
	endpointLabel,
	isConfigured,
	loadEndpoints,
	loadSettings,
	saveSettings,
	upsertEndpoint,
} from '../src/settings'
import { installGmStorageMock } from './helpers'

let store: Map<string, unknown>

beforeEach(() => {
	store = installGmStorageMock()
})

describe('settings 存储', () => {
	it('无存储时返回默认值', () => {
		expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
	})

	it('存储损坏（非法 JSON）时回退默认值', () => {
		store.set('pa_settings', '{broken json')
		expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
	})

	it('保存后可完整读回', () => {
		const s = {
			model: 'qwen3.5-plus',
			baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
			apiKey: 'sk-test',
			language: 'zh-CN' as const,
			bypassCors: false,
		}
		saveSettings(s)
		expect(loadSettings()).toEqual(s)
	})

	it('旧版本存储缺少新字段时用默认值补齐', () => {
		store.set('pa_settings', JSON.stringify({ model: 'gpt-5.4-mini', baseURL: 'https://x/v1' }))
		const s = loadSettings()
		expect(s.model).toBe('gpt-5.4-mini')
		expect(s.language).toBe('auto')
		expect(s.bypassCors).toBe(false)
	})
})

describe('isConfigured 最小配置判断', () => {
	it('baseURL 和 model 都有 → true（apiKey 可空，本地 LLM 不需要）', () => {
		expect(isConfigured({ ...DEFAULT_SETTINGS, baseURL: 'http://localhost:11434/v1', model: 'qwen3:14b' })).toBe(true)
	})

	it('缺 model → false', () => {
		expect(isConfigured({ ...DEFAULT_SETTINGS, baseURL: 'https://x/v1' })).toBe(false)
	})

	it('缺 baseURL → false', () => {
		expect(isConfigured({ ...DEFAULT_SETTINGS, model: 'qwen3.5-plus' })).toBe(false)
	})

	it('空白字符串视为未配置', () => {
		expect(isConfigured({ ...DEFAULT_SETTINGS, baseURL: '  ', model: ' ' })).toBe(false)
	})
})

describe('端点列表', () => {
	const ep1 = {
		model: 'gpt-5.4-mini',
		baseURL: 'https://api.openai.com/v1',
		apiKey: 'sk-1',
		language: 'en-US' as const,
		bypassCors: false,
	}
	const ep2 = {
		model: 'qwen3.5-plus',
		baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
		apiKey: 'sk-2',
		language: 'auto' as const,
		bypassCors: true,
	}

	it('空存储 → 空列表', () => {
		expect(loadEndpoints()).toEqual([])
	})

	it('upsert：不存在则追加', () => {
		upsertEndpoint(ep1)
		upsertEndpoint(ep2)
		expect(loadEndpoints()).toHaveLength(2)
	})

	it('upsert：[model+baseURL] 匹配则覆盖而非重复', () => {
		upsertEndpoint(ep1)
		upsertEndpoint(ep2)
		const updated = { ...ep1, apiKey: 'sk-new', language: 'zh-CN' as const }
		upsertEndpoint(updated)
		const list = loadEndpoints()
		expect(list).toHaveLength(2)
		expect(list[0].apiKey).toBe('sk-new')
		expect(list[0].language).toBe('zh-CN')
	})

	it('upsert：同 baseURL 不同 model 视为不同端点', () => {
		upsertEndpoint(ep1)
		upsertEndpoint({ ...ep1, model: 'gpt-5.4-nano' })
		expect(loadEndpoints()).toHaveLength(2)
	})

	it('delete：按 [model+baseURL] 删除', () => {
		upsertEndpoint(ep1)
		upsertEndpoint(ep2)
		deleteEndpoint(ep1.model, ep1.baseURL)
		const list = loadEndpoints()
		expect(list).toHaveLength(1)
		expect(list[0].model).toBe('qwen3.5-plus')
	})

	it('endpointLabel：`模型 - [host]` 格式，含端口', () => {
		expect(endpointLabel({ model: 'gpt-5.4-mini', baseURL: 'https://llm.example.com:8443/v1' })).toBe(
			'gpt-5.4-mini - [llm.example.com:8443]',
		)
	})

	it('endpointLabel：非法 URL 回退原始字符串', () => {
		expect(endpointLabel({ model: 'm', baseURL: 'not-a-url' })).toBe('m - [not-a-url]')
	})

	it('存储损坏 → 空列表', () => {
		store.set('pa_endpoints', '{oops')
		expect(loadEndpoints()).toEqual([])
	})
})
