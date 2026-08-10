/**
 * 构建期注入的常量；本地测试（vitest）没有 define，回退到开发值。
 */
export const PAGE_AGENT_VERSION: string =
	typeof __PAGE_AGENT_VERSION__ !== 'undefined' ? __PAGE_AGENT_VERSION__ : '0.0.0-dev'

export const USERSCRIPT_VERSION: string =
	typeof __USERSCRIPT_VERSION__ !== 'undefined' ? __USERSCRIPT_VERSION__ : '0.0.0-dev'

export const UPDATE_URL: string =
	typeof __UPDATE_URL__ !== 'undefined'
		? __UPDATE_URL__
		: 'https://raw.githubusercontent.com/flashlab/page-agent-userscript/main/dist/page-agent-userscript.user.js'
