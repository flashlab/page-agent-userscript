/**
 * 比较两个语义化版本号。a > b 返回 1，a < b 返回 -1，相等返回 0。
 * 非数字段（预发布标签等）按 0 处理，对本项目"上游发新版"的判断足够。
 */
export function compareVersions(a: string, b: string): number {
	const pa = a.replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0)
	const pb = b.replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0)
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] || 0) - (pb[i] || 0)
		if (d !== 0) return d > 0 ? 1 : -1
	}
	return 0
}

export interface VersionCheckResult {
	current: string
	latest: string
	hasUpdate: boolean
}

const REGISTRY_URL = 'https://registry.npmjs.org/page-agent/latest'

/** 经 GM_xmlhttpRequest 查询 npm registry 上 page-agent 的最新版本 */
export function checkLatestVersion(current: string): Promise<VersionCheckResult> {
	return new Promise((resolve, reject) => {
		GM_xmlhttpRequest({
			method: 'GET',
			url: REGISTRY_URL,
			timeout: 8000,
			onload: (res) => {
				try {
					const info = JSON.parse(res.responseText) as { version?: string }
					if (!info.version) throw new Error('missing version')
					resolve({
						current,
						latest: info.version,
						hasUpdate: compareVersions(info.version, current) > 0,
					})
				} catch {
					reject(new Error('无法解析 npm registry 响应'))
				}
			},
			onerror: () => reject(new Error('版本检查请求失败')),
			ontimeout: () => reject(new Error('版本检查超时')),
		})
	})
}
