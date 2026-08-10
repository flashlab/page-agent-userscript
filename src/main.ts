import { launchPageAgent } from './launcher'
import { openSettingsPanel } from './settings-panel'

GM_registerMenuCommand('🚀 启动 Page-Agent', launchPageAgent)
GM_registerMenuCommand('⚙️ Page-Agent 设置', () => {
	openSettingsPanel()
})
