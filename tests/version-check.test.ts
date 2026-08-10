import { describe, expect, it } from 'vitest'

import { checkLatestVersion, compareVersions } from '../src/version-check'
import { installGmXhrMock } from './helpers'

describe('compareVersions', () => {
	it.each([
		['1.12.3', '1.12.2', 1],
		['1.12.2', '1.12.2', 0],
		['1.12.2', '1.13.0', -1],
		['2.0.0', '1.99.99', 1],
		['v1.2.0', '1.2.0', 0],
		['1.2', '1.2.0', 0],
	])('%s vs %s → %i', (a, b, expected) => {
		expect(compareVersions(a, b)).toBe(expected)
	})
})

describe('checkLatestVersion', () => {
	it('上游更新时 hasUpdate 为 true，并请求了正确的 registry 地址', async () => {
		const { requests } = installGmXhrMock((req) => {
			req.onload?.({ status: 200, responseText: JSON.stringify({ version: '9.9.9' }), responseHeaders: '' })
		})
		const r = await checkLatestVersion('1.12.2')
		expect(r).toEqual({ current: '1.12.2', latest: '9.9.9', hasUpdate: true })
		expect(requests[0].url).toBe('https://registry.npmjs.org/page-agent/latest')
	})

	it('版本相同 → hasUpdate 为 false', async () => {
		installGmXhrMock((req) => {
			req.onload?.({ status: 200, responseText: JSON.stringify({ version: '1.12.2' }), responseHeaders: '' })
		})
		const r = await checkLatestVersion('1.12.2')
		expect(r.hasUpdate).toBe(false)
	})

	it('响应不是合法 JSON → reject', async () => {
		installGmXhrMock((req) => {
			req.onload?.({ status: 200, responseText: '<html>oops</html>', responseHeaders: '' })
		})
		await expect(checkLatestVersion('1.12.2')).rejects.toThrow('无法解析')
	})

	it('网络错误 → reject', async () => {
		installGmXhrMock((req) => {
			req.onerror?.()
		})
		await expect(checkLatestVersion('1.12.2')).rejects.toThrow('失败')
	})
})
