/**
 * 通过 GM_xmlhttpRequest 实现的 fetch 兼容函数。
 * 油猴的跨域请求不受页面 CORS 限制，因此可以让任意 OpenAI 兼容端点在任意网页上可用。
 *
 * 注意：响应是非流式的——即使 LLM 请求开了 stream，也会等全部内容到齐后一次性返回，
 * 面板里的逐字输出效果会变差，但功能不受影响。
 */

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
	if (!headers) return {}
	if (headers instanceof Headers) {
		const out: Record<string, string> = {}
		headers.forEach((v, k) => (out[k] = v))
		return out
	}
	if (Array.isArray(headers)) {
		const out: Record<string, string> = {}
		for (const [k, v] of headers) out[k] = v
		return out
	}
	return { ...(headers as Record<string, string>) }
}

function parseResponseHeaders(raw: string): Record<string, string> {
	const out: Record<string, string> = {}
	for (const line of raw.split(/\r?\n/)) {
		const idx = line.indexOf(':')
		if (idx > 0) out[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim()
	}
	return out
}

export function gmFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
	return new Promise((resolve, reject) => {
		GM_xmlhttpRequest({
			method: (init?.method?.toUpperCase() ?? 'GET') as 'GET',
			url,
			headers: normalizeHeaders(init?.headers),
			data: (init?.body as string | undefined) ?? undefined,
			timeout: 180_000,
			onload: (r) => {
				resolve(
					new Response(r.responseText ?? '', {
						status: r.status,
						headers: parseResponseHeaders(r.responseHeaders || ''),
					}),
				)
			},
			onerror: () => reject(new TypeError(`LLM 请求失败（GM_xmlhttpRequest）: ${url}`)),
			ontimeout: () => reject(new TypeError(`LLM 请求超时: ${url}`)),
		})
	})
}
