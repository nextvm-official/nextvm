/**
 * Generate the NUI section of an fxmanifest.lua file.
 * declare `ui_page` plus the file list FiveM is allowed to serve. This
 * helper turns the Vite build output into that snippet so the build
 * pipeline can append it to the existing manifest.
 * Output shape (literal example):
 *   -- @nextvm/vite-plugin-nui
 *   ui_page 'nui/index.html'
 *   files {
 *     'nui/index.html',
 *     'nui/assets/index-abc123.js',
 *     'nui/assets/index-def456.css',
 *   }
 */
export interface FxmanifestSnippetInput {
	/** Folder name inside the resource that holds the NUI build (default 'nui') */
	uiDir?: string
	/** Every file Vite emitted, relative to the Vite outDir */
	files: string[]
}

export function generateFxmanifestSnippet(input: FxmanifestSnippetInput): string {
	const uiDir = input.uiDir ?? 'nui'
	const indexFile = input.files.find((f) => f === 'index.html')
	if (!indexFile) {
		throw new Error(
			'@nextvm/vite-plugin-nui: NUI build output is missing index.html',
		)
	}
	const lines: string[] = []
	lines.push("-- @nextvm/vite-plugin-nui")
	lines.push(`ui_page '${uiDir}/index.html'`)
	lines.push('files {')
	for (const file of input.files) {
		lines.push(`\t'${uiDir}/${file}',`)
	}
	lines.push('}')
	return `${lines.join('\n')}\n`
}
