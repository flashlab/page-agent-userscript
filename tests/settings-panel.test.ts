import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PRESET_BASE_URLS, RECOMMENDED_MODELS } from '../src/presets'
import { closeSettingsPanel, openSettingsPanel } from '../src/settings-panel'
import { installGmStorageMock, installGmXhrMock } from './helpers'

let store: Map<string, unknown>

beforeEach(() => {
	store = installGmStorageMock()
	// 默认：版本检查固定返回"已是最新"
	installGmXhrMock((req) => {
		req.onload?.({ status: 200, responseText: JSON.stringify({ version: '0.0.0' }), responseHeaders: '' })
	})
})

afterEach(() => {
	closeSettingsPanel()
})

const flush = () => new Promise((r) => setTimeout(r, 0))

const openAndFill = () => {
	const handle = openSettingsPanel()
	const { root } = handle
	const $ = <T extends HTMLInputElement | HTMLSelectElement>(id: string) =>
		root.querySelector<T>(`#${id}`) as T
	return { handle, root, $ }
}

const fillValid = ($: ReturnType<typeof openAndFill>['$']) => {
	$('model').value = 'qwen3.5-plus'
	$('baseURL').value = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
	$('apiKey').value = 'sk-test'
	$('language').value = 'zh-CN'
	;(document.activeElement as HTMLElement)?.blur?.()
}

describe('设置面板 · 基础', () => {
	it('model datalist 恰好列出 7 个星标推荐模型', () => {
		const { root } = openSettingsPanel()
		const options = [...root.querySelectorAll<HTMLOptionElement>('#pa-models option')].map((o) => o.value)
		expect(options).toHaveLength(7)
		expect(options).toEqual([...RECOMMENDED_MODELS])
	})

	it('baseURL datalist 列出预置端点', () => {
		const { root } = openSettingsPanel()
		const options = [...root.querySelectorAll<HTMLOptionElement>('#pa-baseurls option')].map((o) => o.value)
		expect(options).toEqual(PRESET_BASE_URLS.map((p) => p.url))
	})

	it('打开时自动发起版本检查并最终显示检查结果', async () => {
		const { root } = openSettingsPanel()
		expect(root.querySelector('#version')!.textContent).toContain('检查更新中')
		await flush()
		expect(root.querySelector('#version')!.textContent).toContain('已是最新')
	})

	it('上游有新版时显示更新提示和手动更新链接', async () => {
		installGmXhrMock((req) => {
			req.onload?.({ status: 200, responseText: JSON.stringify({ version: '99.0.0' }), responseHeaders: '' })
		})
		const { root } = openSettingsPanel()
		await flush()
		const versionEl = root.querySelector('#version')!
		expect(versionEl.textContent).toContain('99.0.0')
		expect(versionEl.querySelector('a')?.href).toContain('page-agent-userscript.user.js')
	})

	it('传入 notice 时显示提示条', () => {
		const { root } = openSettingsPanel({ notice: '首次使用请先完成配置' })
		const notice = root.querySelector('#notice')!
		expect(notice.textContent).toBe('首次使用请先完成配置')
		expect(notice.classList.contains('show')).toBe(true)
	})

	it('已保存的设置在重新打开时回填', () => {
		store.set(
			'pa_settings',
			JSON.stringify({
				model: 'gpt-5.4-nano',
				baseURL: 'https://api.openai.com/v1',
				apiKey: 'sk-x',
				language: 'en-US',
				requestMode: 'proxy',
			}),
		)
		const { root } = openSettingsPanel()
		expect(root.querySelector<HTMLInputElement>('#model')!.value).toBe('gpt-5.4-nano')
		expect(root.querySelector<HTMLInputElement>('#baseURL')!.value).toBe('https://api.openai.com/v1')
		expect(root.querySelector<HTMLSelectElement>('#language')!.value).toBe('en-US')
		expect(root.querySelector<HTMLSelectElement>('#requestMode')!.value).toBe('proxy')
	})

	it('重复打开是单例（先关旧面板）', () => {
		openSettingsPanel()
		openSettingsPanel()
		expect(document.querySelectorAll('#page-agent-userscript-settings')).toHaveLength(1)
	})
})

describe('设置面板 · 应用与端点列表', () => {
	it('必填缺失时拒绝应用', () => {
		const { root } = openSettingsPanel()
		;(root.querySelector('#apply') as HTMLButtonElement).click()
		expect(root.querySelector('#status')!.textContent).toContain('不能为空')
		expect(store.has('pa_settings')).toBe(false)
		expect(store.has('pa_endpoints')).toBe(false)
	})

	it('应用：写入当前配置 + 新增到端点列表', () => {
		const { root, $ } = openAndFill()
		fillValid($)
		;(root.querySelector('#apply') as HTMLButtonElement).click()

		const saved = JSON.parse(store.get('pa_settings') as string)
		expect(saved.model).toBe('qwen3.5-plus')
		expect(saved.language).toBe('zh-CN')

		const endpoints = JSON.parse(store.get('pa_endpoints') as string)
		expect(endpoints).toHaveLength(1)
		expect(endpoints[0].baseURL).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1')
		expect(root.querySelector('#status')!.textContent).toContain('已应用')
	})

	it('应用两次同 [model+baseURL]：覆盖而非重复', () => {
		const { root, $ } = openAndFill()
		fillValid($)
		;(root.querySelector('#apply') as HTMLButtonElement).click()
		$('apiKey').value = 'sk-updated'
		;(root.querySelector('#apply') as HTMLButtonElement).click()
		const endpoints = JSON.parse(store.get('pa_endpoints') as string)
		expect(endpoints).toHaveLength(1)
		expect(endpoints[0].apiKey).toBe('sk-updated')
	})

	it('端点列表为空时不显示下拉；应用后出现', () => {
		const { root, $ } = openAndFill()
		expect(root.querySelector('#dropdown')!.classList.contains('show')).toBe(false)
		fillValid($)
		;(root.querySelector('#apply') as HTMLButtonElement).click()
		expect(root.querySelector('#dropdown')!.classList.contains('show')).toBe(true)
	})

	it('下拉项文案为 `模型 - [host]`，点击加载配置', () => {
		store.set('pa_endpoints', JSON.stringify([{
			model: 'gpt-5.4-mini',
			baseURL: 'https://llm.example.com:8443/v1',
			apiKey: 'sk-cpa',
			language: 'en-US',
			requestMode: 'proxy',
		}]))
		const { root, $ } = openAndFill()
		;(root.querySelector('#dropdownToggle') as HTMLButtonElement).click()

		const item = root.querySelector('.item')!
		expect(item.querySelector('.label')!.textContent).toBe('gpt-5.4-mini - [llm.example.com:8443]')
		;(item as HTMLElement).click()

		expect($('model').value).toBe('gpt-5.4-mini')
		expect($('baseURL').value).toBe('https://llm.example.com:8443/v1')
		expect($('apiKey').value).toBe('sk-cpa')
		expect($('language').value).toBe('en-US')
		expect($('requestMode').value).toBe('proxy')
		expect(root.querySelector('#status')!.textContent).toContain('已加载')
	})

	it('每行有删除按钮，点击删除对应项', () => {
		store.set('pa_endpoints', JSON.stringify([
			{ model: 'm1', baseURL: 'https://a.com/v1', apiKey: '', language: 'auto', requestMode: 'auto' },
			{ model: 'm2', baseURL: 'https://b.com/v1', apiKey: '', language: 'auto', requestMode: 'auto' },
		]))
		const { root } = openAndFill()
		;(root.querySelector('#dropdownToggle') as HTMLButtonElement).click()
		expect(root.querySelectorAll('.item')).toHaveLength(2)

		const firstDel = root.querySelector('.item .del') as HTMLButtonElement
		expect(firstDel).toBeTruthy()
		firstDel.click()

		const endpoints = JSON.parse(store.get('pa_endpoints') as string)
		expect(endpoints).toHaveLength(1)
		expect(endpoints[0].model).toBe('m2')
		// 菜单重渲染后只剩一项
		expect(root.querySelectorAll('.item')).toHaveLength(1)
	})

	it('删光后端点下拉隐藏', () => {
		store.set('pa_endpoints', JSON.stringify([
			{ model: 'm1', baseURL: 'https://a.com/v1', apiKey: '', language: 'auto', requestMode: 'auto' },
		]))
		const { root } = openAndFill()
		;(root.querySelector('#dropdownToggle') as HTMLButtonElement).click()
		;(root.querySelector('.item .del') as HTMLButtonElement).click()
		expect(root.querySelector('#dropdown')!.classList.contains('show')).toBe(false)
	})
})

describe('设置面板 · 重置与关闭', () => {
	it('重置：表单还原默认值，但不写入存储', () => {
		const { root, $ } = openAndFill()
		fillValid($)
		;(root.querySelector('#reset') as HTMLButtonElement).click()
		expect($('model').value).toBe('')
		expect($('baseURL').value).toBe('')
		expect($('apiKey').value).toBe('')
		expect($('language').value).toBe('auto')
		expect($('requestMode').value).toBe('auto')
		expect(store.has('pa_settings')).toBe(false)
	})

	it('右上角关闭按钮关闭面板', () => {
		const { root } = openSettingsPanel()
		;(root.querySelector('#close') as HTMLButtonElement).click()
		expect(document.querySelector('#page-agent-userscript-settings')).toBeNull()
	})

	it('点击卡片之外（遮罩）不关闭面板', () => {
		const { root } = openSettingsPanel()
		const backdrop = root.querySelector('.backdrop') as HTMLElement
		backdrop.click()
		expect(document.querySelector('#page-agent-userscript-settings')).not.toBeNull()
	})
})
