export type LanguageSetting = 'auto' | 'zh-CN' | 'en-US'

export interface Settings {
	model: string
	baseURL: string
	apiKey: string
	language: LanguageSetting
	/** 经 GM_xmlhttpRequest 代理 LLM 请求，绕过页面 CORS 限制 */
	bypassCors: boolean
}

export const DEFAULT_SETTINGS: Settings = {
	model: '',
	baseURL: '',
	apiKey: '',
	language: 'auto',
	/**
	 * 主流云端端点（OpenAI / 百炼 / DeepSeek / Gemini）已实测原生支持 CORS，
	 * 默认直连以保留流式输出；遇到不支持 CORS 的端点再打开此开关。
	 */
	bypassCors: false,
}

const STORAGE_KEY = 'pa_settings'

/** 从油猴跨站点存储读取设置，损坏或缺失时回退默认值 */
export function loadSettings(): Settings {
	try {
		const raw = GM_getValue(STORAGE_KEY, null as unknown)
		if (raw == null) return { ...DEFAULT_SETTINGS }
		const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
		if (typeof parsed !== 'object') return { ...DEFAULT_SETTINGS }
		return { ...DEFAULT_SETTINGS, ...(parsed as Partial<Settings>) }
	} catch {
		return { ...DEFAULT_SETTINGS }
	}
}

export function saveSettings(settings: Settings): void {
	GM_setValue(STORAGE_KEY, JSON.stringify(settings))
}

/**
 * 是否已完成最小配置。
 * apiKey 允许为空：本地 LLM（Ollama/LM Studio）和免费测试端点都不需要。
 */
export function isConfigured(settings: Settings): boolean {
	return Boolean(settings.baseURL.trim() && settings.model.trim())
}

// ---------- 端点列表（endpoint list） ----------

/** 一个已存端点 = 一整套配置 */
export type Endpoint = Settings

const ENDPOINTS_KEY = 'pa_endpoints'

export function loadEndpoints(): Endpoint[] {
	try {
		const raw = GM_getValue(ENDPOINTS_KEY, null as unknown)
		const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
		if (!Array.isArray(parsed)) return []
		return parsed
			.filter((e) => e && typeof e === 'object')
			.map((e) => ({ ...DEFAULT_SETTINGS, ...(e as Partial<Endpoint>) }))
	} catch {
		return []
	}
}

export function saveEndpoints(list: Endpoint[]): void {
	GM_setValue(ENDPOINTS_KEY, JSON.stringify(list))
}

/** 以 [model + baseURL] 为唯一键 upsert：已存在则覆盖，不存在则追加。返回新列表。 */
export function upsertEndpoint(endpoint: Endpoint): Endpoint[] {
	const list = loadEndpoints()
	const idx = list.findIndex((e) => e.model === endpoint.model && e.baseURL === endpoint.baseURL)
	if (idx >= 0) list[idx] = endpoint
	else list.push(endpoint)
	saveEndpoints(list)
	return list
}

export function deleteEndpoint(model: string, baseURL: string): Endpoint[] {
	const list = loadEndpoints().filter((e) => !(e.model === model && e.baseURL === baseURL))
	saveEndpoints(list)
	return list
}

/** 下拉菜单里的展示文案：`模型 - [api host]`，URL 解析失败时回退原始字符串 */
export function endpointLabel(endpoint: Pick<Endpoint, 'model' | 'baseURL'>): string {
	let host = endpoint.baseURL
	try {
		host = new URL(endpoint.baseURL).host
	} catch {
		// 保留原始字符串
	}
	return `${endpoint.model} - [${host}]`
}
