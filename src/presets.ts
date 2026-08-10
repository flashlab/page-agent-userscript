/**
 * ⭐ 推荐模型列表（2026-08 快照）
 * 来源: https://alibaba.github.io/page-agent/docs/features/models
 * 对应源码: packages/website/src/pages/docs/features/models/page.tsx 中的 BASELINE 集合
 * 注: datalist 只提供建议，用户仍可自由输入任意模型名。
 */
export const RECOMMENDED_MODELS: readonly string[] = [
	'qwen3.5-plus',
	'qwen3.5-flash',
	'gpt-5.4-mini',
	'gpt-5.4-nano',
	'claude-haiku-4-5',
	'gemini-3.5-flash',
	'deepseek-v4-flash',
]

/** baseURL 常用端点预置（同样允许自由输入） */
export const PRESET_BASE_URLS: readonly { label: string; url: string }[] = [
	{ label: '阿里云百炼（OpenAI 兼容模式）', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
	{ label: 'OpenAI 官方', url: 'https://api.openai.com/v1' },
	{
		label: 'PageAgent 免费测试端点（仅限技术评估，勿用于生产）',
		url: 'https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run',
	},
]
