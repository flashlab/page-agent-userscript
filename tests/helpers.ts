/**
 * 在 globalThis 上安装 Map 实现的 GM 存储 mock，返回底层 Map 便于断言。
 * 每个测试文件的 beforeEach 里调用。
 */
export function installGmStorageMock(): Map<string, unknown> {
	const store = new Map<string, unknown>()
	;(globalThis as Record<string, unknown>).GM_getValue = (key: string, def: unknown) =>
		store.has(key) ? store.get(key) : def
	;(globalThis as Record<string, unknown>).GM_setValue = (key: string, value: unknown) => {
		store.set(key, value)
	}
	return store
}

export interface XhrRequest {
	method: string
	url: string
	onload?: (res: { status: number; responseText: string; responseHeaders: string }) => void
	onerror?: () => void
	ontimeout?: () => void
}

/**
 * 安装 GM_xmlhttpRequest mock：记录请求，调用 respond 回调触发 onload/onerror。
 */
export function installGmXhrMock(
	respond: (req: XhrRequest) => void,
): { requests: XhrRequest[] } {
	const requests: XhrRequest[] = []
	;(globalThis as Record<string, unknown>).GM_xmlhttpRequest = (details: XhrRequest) => {
		requests.push(details)
		respond(details)
	}
	return { requests }
}
