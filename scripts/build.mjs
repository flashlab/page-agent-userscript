import { readFileSync } from 'node:fs'
import * as esbuild from 'esbuild'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const pageAgentPkg = JSON.parse(
	readFileSync(new URL('../node_modules/page-agent/package.json', import.meta.url), 'utf8'),
)

const UPDATE_URL =
	'https://raw.githubusercontent.com/flashlab/page-agent-userscript/main/dist/page-agent-userscript.user.js'

const banner = `// ==UserScript==
// @name         Page-Agent Userscript
// @namespace    https://github.com/flashlab/page-agent-userscript
// @version      ${pkg.version}
// @description  在任意网页手动启动 page-agent：油猴封装，支持自定义 model/baseURL/apiKey/language
// @author       flashlab
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      registry.npmjs.org
// @connect      *
// @run-at       document-idle
// @noframes
// @updateURL    ${UPDATE_URL}
// @downloadURL  ${UPDATE_URL}
// @license      MIT
// ==/UserScript==
`

/** @type {import('esbuild').BuildOptions} */
const options = {
	entryPoints: ['src/main.ts'],
	bundle: true,
	format: 'iife',
	target: 'es2022',
	outfile: 'dist/page-agent-userscript.user.js',
	banner: { js: banner },
	define: {
		__PAGE_AGENT_VERSION__: JSON.stringify(pageAgentPkg.version),
		__USERSCRIPT_VERSION__: JSON.stringify(pkg.version),
		__UPDATE_URL__: JSON.stringify(UPDATE_URL),
	},
	// 库自身带 sourcemap 引用，打包产物不生成 map（减小体积）
	sourcemap: false,
	logLevel: 'info',
}

if (process.argv.includes('--watch')) {
	const ctx = await esbuild.context(options)
	await ctx.watch()
	console.log('[build] watching…')
} else {
	await esbuild.build(options)
	console.log(
		`[build] userscript v${pkg.version} · bundled page-agent v${pageAgentPkg.version}`,
	)
}
