import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { gmFetch, smartFetch } from '../src/gm-fetch'
import { installGmXhrMock } from './helpers'

describe('gmFetch（GM 代理）', () => {
	it('把 GM_xmlhttpRequest 响应包装成 Response', async () => {
		const { requests } = installGmXhrMock((req) => {
			req.onload?.({
				status: 200,
				responseText: '{"ok":true}',
				responseHeaders: 'content-type: application/json\r\nx-trace: abc',
			})
		})
		const res = await gmFetch('https://llm.example.com/v1/chat/completions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: 'Bearer k' },
			body: '{}',
		})
		expect(res.status).toBe(200)
		expect(await res.json()).toEqual({ ok: true })
		expect(res.headers.get('x-trace')).toBe('abc')
		expect(requests[0].method).toBe('POST')
		expect(requests[0].url).toBe('https://llm.example.com/v1/chat/completions')
	})

	it('网络错误时 reject', async () => {
		installGmXhrMock((req) => req.onerror?.())
		await expect(gmFetch('https://x/v1')).rejects.toThrow('GM_xmlhttpRequest')
	})
})

describe('smartFetch（自动模式）', () => {
	const realFetch = globalThis.fetch

	beforeEach(() => {
		installGmXhrMock((req) => {
			req.onload?.({ status: 200, responseText: '{"via":"proxy"}', responseHeaders: '' })
		})
	})
	afterEach(() => {
		globalThis.fetch = realFetch
	})

	it('直连成功时不碰代理', async () => {
		globalThis.fetch = vi.fn(async () => new Response('{"via":"direct"}', { status: 200 }))
		const res = await smartFetch('https://x/v1/chat/completions', { method: 'POST' })
		expect(await res.json()).toEqual({ via: 'direct' })
	})

	it('直连被 CSP/CORS 拦截（抛 TypeError）时回退代理', async () => {
		globalThis.fetch = vi.fn(async () => {
			throw new TypeError('Failed to fetch')
		})
		const res = await smartFetch('https://x/v1/chat/completions', { method: 'POST' })
		expect(await res.json()).toEqual({ via: 'proxy' })
	})

	it('HTTP 错误状态是正常响应，不回退', async () => {
		globalThis.fetch = vi.fn(async () => new Response('{"error":"bad key"}', { status: 401 }))
		const res = await smartFetch('https://x/v1')
		expect(res.status).toBe(401)
	})
})
