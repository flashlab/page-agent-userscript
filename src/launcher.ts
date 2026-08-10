import { PageAgent, PageAgentConfig } from 'page-agent'

import { gmFetch } from './gm-fetch'
import { isConfigured, loadSettings } from './settings'
import { openSettingsPanel } from './settings-panel'

/**
 * 启动 Page-Agent：
 * - 未完成最小配置（baseURL + model）→ 弹设置面板并提示
 * - 已有实例运行 → 先 dispose 再按当前配置重建（保证配置改动立即生效）
 */
export function launchPageAgent(): void {
	const settings = loadSettings()
	if (!isConfigured(settings)) {
		openSettingsPanel({ notice: '首次使用请先完成配置：至少需要 baseURL 和 model' })
		return
	}

	try {
		window.pageAgent?.dispose()
	} catch {
		// 旧实例销毁失败不阻塞重建
	}

	const config: PageAgentConfig = {
		baseURL: settings.baseURL,
		model: settings.model,
	}
	if (settings.apiKey) config.apiKey = settings.apiKey
	if (settings.language !== 'auto') config.language = settings.language
	if (settings.bypassCors) config.customFetch = gmFetch

	const agent = new PageAgent(config)
	window.pageAgent = agent
	agent.panel.show()
}
