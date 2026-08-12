import { PAGE_AGENT_VERSION, UPDATE_URL, USERSCRIPT_VERSION } from './constants'
import { PRESET_BASE_URLS, RECOMMENDED_MODELS } from './presets'
import {
	DEFAULT_SETTINGS,
	deleteEndpoint,
	Endpoint,
	endpointLabel,
	LanguageSetting,
	loadEndpoints,
	loadSettings,
	saveSettings,
	Settings,
	upsertEndpoint,
} from './settings'
import { checkLatestVersion } from './version-check'

export interface SettingsPanelHandle {
	/** 关闭并移除面板 */
	close: () => void
	/** ShadowRoot 引用（closed 模式下页面脚本拿不到，我们自己保留用于内部操作与测试） */
	root: ShadowRoot
}

export interface OpenPanelOptions {
	/** 面板顶部显示的提示（例如首次使用时"请先完成配置"） */
	notice?: string
}

let currentPanel: SettingsPanelHandle | null = null

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; margin: 0; padding: 0; }
.backdrop {
  position: fixed; inset: 0; z-index: 2147483646;
  background: rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center;
}
.modal {
  position: relative;
  width: 420px; max-width: calc(100vw - 32px); max-height: calc(100vh - 64px);
  overflow-y: auto;
  background: #fff; color: #1f2937; border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,.35);
  padding: 20px 22px;
  font: 14px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  .modal { background: #1f2937; color: #e5e7eb; }
  .modal input, .modal select { background: #111827; color: #e5e7eb; border-color: #4b5563; }
  .modal .menu { background: #111827; border-color: #4b5563; }
  .modal .item:hover { background: #374151; }
  .modal .cancel { border-color: #4b5563; }
  .hint { color: #9ca3af !important; }
}
h2 { font-size: 16px; font-weight: 600; margin-bottom: 4px; padding-right: 28px; }
.close-x {
  position: absolute; top: 12px; right: 12px;
  width: 28px; height: 28px; padding: 0;
  border: none; border-radius: 6px;
  background: transparent; color: inherit; font-size: 15px; line-height: 1;
  cursor: pointer; opacity: .55;
}
.close-x:hover { opacity: 1; background: rgba(127,127,127,.18); }
.notice {
  display: none; margin: 8px 0; padding: 8px 10px; border-radius: 8px;
  background: #fef3c7; color: #92400e; font-size: 13px;
}
.notice.show { display: block; }
.version { font-size: 12px; margin: 6px 0 14px; }
.version a { color: #2563eb; }
.version .update { color: #d97706; font-weight: 600; }
label { display: block; margin-top: 12px; font-size: 13px; font-weight: 500; }
input, select {
  width: 100%; margin-top: 4px; padding: 7px 9px;
  border: 1px solid #d1d5db; border-radius: 8px;
  font: 13px/1.4 ui-monospace, monospace;
  background: #fff; color: inherit;
}
input:focus, select:focus { outline: 2px solid #58c0fc; border-color: transparent; }
.hint { font-size: 12px; color: #6b7280; margin-top: 3px; font-weight: 400; }
.row { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.row input[type=checkbox] { width: auto; margin: 0; }
.row label { margin: 0; font-weight: 400; }
.buttons { display: flex; gap: 8px; margin-top: 18px; align-items: stretch; }
button { font-size: 14px; cursor: pointer; border-radius: 8px; }
.apply { flex: 1; padding: 8px 0; border: none; background: #58c0fc; color: #fff; font-weight: 600; }
.apply:hover { background: #3aa8ec; }
.cancel { padding: 8px 14px; background: transparent; color: inherit; border: 1px solid #d1d5db; }
.dropdown { position: relative; display: none; }
.dropdown.show { display: block; }
.menu {
  position: absolute; bottom: calc(100% + 6px); right: 0; z-index: 10;
  min-width: 240px; max-width: 320px; max-height: 220px; overflow-y: auto;
  background: #fff; border: 1px solid #d1d5db; border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,.18);
  padding: 4px;
}
.item {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px; border-radius: 6px; cursor: pointer;
  font: 12px/1.4 ui-monospace, monospace;
  white-space: nowrap; overflow: hidden;
}
.item:hover { background: #f3f4f6; }
.item .label { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.item .del {
  flex: none; width: 20px; height: 20px; padding: 0;
  border: none; border-radius: 4px;
  background: transparent; color: #9ca3af; font-size: 12px; line-height: 1;
  opacity: 0; transition: opacity .12s;
}
.item:hover .del { opacity: 1; }
.item .del:hover { background: #fee2e2; color: #dc2626; }
.status { min-height: 18px; margin-top: 10px; font-size: 13px; text-align: center; }
.status.ok { color: #059669; }
.status.err { color: #dc2626; }
`

function el(html: string): HTMLElement {
	const t = document.createElement('template')
	t.innerHTML = html.trim()
	return t.content.firstElementChild as HTMLElement
}

/** 打开设置面板（单例：重复打开会先关掉旧的）。返回句柄。 */
export function openSettingsPanel(options: OpenPanelOptions = {}): SettingsPanelHandle {
	closeSettingsPanel()

	const settings = loadSettings()

	const host = document.createElement('div')
	host.id = 'page-agent-userscript-settings'
	const root = host.attachShadow({ mode: 'closed' })

	const style = document.createElement('style')
	style.textContent = CSS
	root.appendChild(style)

	const backdrop = el(`
    <div class="backdrop">
      <div class="modal" role="dialog" aria-label="Page-Agent 设置">
        <button class="close-x" id="close" title="关闭" aria-label="关闭">✕</button>
        <h2>⚙️ Page-Agent 设置</h2>
        <div class="notice" id="notice"></div>
        <div class="version" id="version">库版本检查中…</div>

        <label>模型 model
          <input id="model" list="pa-models" placeholder="如 qwen3.5-plus" autocomplete="off">
          <datalist id="pa-models"></datalist>
          <div class="hint">⭐ 列表为官方推荐模型，也可以自由输入任意模型名</div>
        </label>

        <label>接口地址 baseURL
          <input id="baseURL" list="pa-baseurls" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" autocomplete="off">
          <datalist id="pa-baseurls"></datalist>
          <div class="hint">任意 OpenAI 兼容端点（含 Ollama / LM Studio 等本地服务）</div>
        </label>

        <label>API Key
          <input id="apiKey" type="password" placeholder="本地 LLM 或免费测试端点可留空" autocomplete="off">
        </label>

        <label>界面语言 language
          <select id="language">
            <option value="auto">跟随浏览器（默认）</option>
            <option value="zh-CN">简体中文</option>
            <option value="en-US">English</option>
          </select>
        </label>

        <div class="row" style="display:block">
          <label>LLM 请求方式
            <select id="requestMode">
              <option value="auto">自动：直连优先，失败时经油猴代理（默认，推荐）</option>
              <option value="direct">强制直连（保留流式输出）</option>
              <option value="proxy">强制经油猴代理（万能，但响应非流式）</option>
            </select>
            <div class="hint">CORS 受限、http 端点、GitHub 等 CSP 严格站点会拦截直连，自动模式可无缝回退</div>
          </label>
        </div>

        <div class="buttons">
          <button class="apply" id="apply">应用</button>
          <div class="dropdown" id="dropdown">
            <button class="cancel" id="dropdownToggle" type="button">已存配置 ▾</button>
            <div class="menu" id="dropdownMenu" hidden></div>
          </div>
          <button class="cancel" id="reset">重置</button>
        </div>
        <div class="status" id="status"></div>
      </div>
    </div>
  `)
	root.appendChild(backdrop)

	const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
		root.querySelector<T>(`#${id}`) as T

	// ---- 填充推荐模型 / 预置端点 datalist ----
	const modelList = $<HTMLDataListElement>('pa-models')
	for (const m of RECOMMENDED_MODELS) {
		const opt = document.createElement('option')
		opt.value = m
		modelList.appendChild(opt)
	}
	const baseUrlList = $<HTMLDataListElement>('pa-baseurls')
	for (const p of PRESET_BASE_URLS) {
		const opt = document.createElement('option')
		opt.value = p.url
		opt.label = p.label
		baseUrlList.appendChild(opt)
	}

	// ---- 表单回填 / 重置 ----
	const fillForm = (s: Settings) => {
		$<HTMLInputElement>('model').value = s.model
		$<HTMLInputElement>('baseURL').value = s.baseURL
		$<HTMLInputElement>('apiKey').value = s.apiKey
		$<HTMLSelectElement>('language').value = s.language
		$<HTMLSelectElement>('requestMode').value = s.requestMode
	}
	const readForm = (): Settings => ({
		model: $<HTMLInputElement>('model').value.trim(),
		baseURL: $<HTMLInputElement>('baseURL').value.trim(),
		apiKey: $<HTMLInputElement>('apiKey').value,
		language: $<HTMLSelectElement>('language').value as LanguageSetting,
		requestMode: $<HTMLSelectElement>('requestMode').value as Settings['requestMode'],
	})
	fillForm(settings)

	if (options.notice) {
		const n = $('notice')
		n.textContent = options.notice
		n.classList.add('show')
	}

	// ---- 打开时自动检查上游库版本 ----
	const versionEl = $('version')
	versionEl.textContent = `脚本 v${USERSCRIPT_VERSION} · 内置 page-agent v${PAGE_AGENT_VERSION} · 检查更新中…`
	checkLatestVersion(PAGE_AGENT_VERSION)
		.then((r) => {
			if (!r.hasUpdate) {
				versionEl.textContent = `脚本 v${USERSCRIPT_VERSION} · 内置 page-agent v${r.current}（已是最新）`
				return
			}
			versionEl.innerHTML = ''
			const span = document.createElement('span')
			span.className = 'update'
			span.textContent = `上游有新版本 v${r.latest}（当前内置 v${r.current}），等待自动构建或 `
			const a = document.createElement('a')
			a.href = UPDATE_URL
			a.textContent = '手动更新脚本'
			a.target = '_blank'
			a.rel = 'noopener noreferrer'
			versionEl.append(`脚本 v${USERSCRIPT_VERSION} · `, span, a)
		})
		.catch((e: Error) => {
			versionEl.textContent = `脚本 v${USERSCRIPT_VERSION} · 内置 page-agent v${PAGE_AGENT_VERSION} · 版本检查失败：${e.message}`
		})

	// ---- 端点下拉菜单 ----
	const dropdown = $('dropdown')
	const menu = $('dropdownMenu')
	const status = $('status')

	const renderDropdown = () => {
		const endpoints = loadEndpoints()
		dropdown.classList.toggle('show', endpoints.length > 0)
		menu.innerHTML = ''
		for (const ep of endpoints) {
			const item = document.createElement('div')
			item.className = 'item'
			const label = document.createElement('span')
			label.className = 'label'
			label.textContent = endpointLabel(ep)
			label.title = `${ep.baseURL}`
			const del = document.createElement('button')
			del.className = 'del'
			del.textContent = '✕'
			del.title = '删除此配置'
			del.addEventListener('click', (e) => {
				e.stopPropagation()
				deleteEndpoint(ep.model, ep.baseURL)
				renderDropdown()
				status.className = 'status'
				status.textContent = `已删除 ${endpointLabel(ep)}`
			})
			item.append(label, del)
			item.addEventListener('click', () => {
				fillForm(ep)
				menu.hidden = true
				status.className = 'status'
				status.textContent = `已加载 ${endpointLabel(ep)}，点「应用」生效`
			})
			menu.appendChild(item)
		}
		if (endpoints.length === 0) menu.hidden = true
	}
	renderDropdown()

	$<HTMLButtonElement>('dropdownToggle').addEventListener('click', (e) => {
		e.stopPropagation()
		menu.hidden = !menu.hidden
	})

	// ---- 按钮行为 ----
	const close = () => closeSettingsPanel()

	$('apply').addEventListener('click', () => {
		const next = readForm()
		if (!next.baseURL || !next.model) {
			status.className = 'status err'
			status.textContent = 'baseURL 和 model 不能为空'
			return
		}
		saveSettings(next)
		upsertEndpoint(next)
		renderDropdown()
		status.className = 'status ok'
		status.textContent = '✓ 已应用'
	})

	$('reset').addEventListener('click', () => {
		fillForm({ ...DEFAULT_SETTINGS })
		status.className = 'status'
		status.textContent = '已重置为默认值（未保存）'
	})

	$('close').addEventListener('click', close)
	const onKey = (e: KeyboardEvent) => {
		if (e.key === 'Escape') close()
	}
	document.addEventListener('keydown', onKey, true)

	document.documentElement.appendChild(host)

	currentPanel = { close, root }
	const origClose = close
	currentPanel.close = () => {
		document.removeEventListener('keydown', onKey, true)
		origClose()
	}
	return currentPanel
}

export function closeSettingsPanel(): void {
	if (!currentPanel) return
	const host = document.getElementById('page-agent-userscript-settings')
	host?.remove()
	currentPanel = null
}
