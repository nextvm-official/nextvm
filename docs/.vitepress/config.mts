import { defineConfig } from 'vitepress'

/**
 * NextVM documentation site configuration.
 *
 * The sidebar is grouped into six sections:
 *   - Guide       — onboarding + tutorials
 *   - Concept     — architecture topics
 *   - Packages    — per @nextvm/* package reference
 *   - Modules     — per first-party game module reference
 *   - CLI         — per `nextvm <command>` reference
 *   - Reference   — PLA, glossary
 */
export default defineConfig({
	title: 'NextVM',
	description: 'A Next-Generation FiveM Framework — TypeScript-first, PLA-compliant',
	// Project-pages live at https://<org>.github.io/nextvm/, so every
	// asset URL needs the /nextvm/ prefix. Override via DOCS_BASE for
	// custom-domain or root-pages deployments.
	base: process.env.DOCS_BASE ?? '/nextvm/',
	cleanUrls: true,
	lastUpdated: true,

	themeConfig: {
		nav: [
			{ text: 'Guide', link: '/guide/getting-started' },
			{ text: 'Concept', link: '/concept/' },
			{ text: 'Packages', link: '/packages/core' },
			{ text: 'Modules', link: '/modules/player' },
			{ text: 'CLI', link: '/cli/create' },
			{ text: 'Reference', link: '/reference/pla' },
		],

		sidebar: {
			'/guide/': [
				{
					text: 'Getting Started',
					items: [
						{ text: 'Introduction', link: '/guide/getting-started' },
						{ text: 'Installation', link: '/guide/installation' },
						{ text: 'Your First Module', link: '/guide/your-first-module' },
					],
				},
				{
					text: 'Building Modules',
					items: [
						{ text: 'Architecture Overview', link: '/guide/architecture-overview' },
						{ text: 'Module Authoring', link: '/guide/module-authoring' },
						{ text: 'Testing', link: '/guide/testing' },
					],
				},
				{
					text: 'Migration',
					items: [
						{ text: 'From ESX', link: '/guide/migration-from-esx' },
						{ text: 'From QBCore', link: '/guide/migration-from-qbcore' },
					],
				},
				{
					text: 'Compliance',
					items: [
						{ text: 'PLA Compliance', link: '/guide/pla-compliance' },
					],
				},
				{
					text: 'Examples',
					items: [
						{ text: 'Full Stack Example', link: '/guide/full-stack-example' },
					],
				},
			],

			'/concept/': [
				{
					text: 'Concept',
					items: [
						{ text: 'Overview', link: '/concept/' },
						{ text: 'Module System', link: '/concept/module-system' },
						{ text: 'Dependency Injection', link: '/concept/dependency-injection' },
						{ text: 'RPC', link: '/concept/rpc' },
						{ text: 'State Management', link: '/concept/state-management' },
						{ text: 'Permissions (ACE)', link: '/concept/permissions' },
						{ text: 'i18n', link: '/concept/i18n' },
						{ text: 'Character System', link: '/concept/character-system' },
						{ text: 'Tick System', link: '/concept/tick-system' },
						{ text: 'Error Boundaries', link: '/concept/error-boundaries' },
						{ text: 'Compatibility Layer', link: '/concept/compatibility-layer' },
					],
				},
			],

			'/packages/': [
				{
					text: 'Layer 2 — Natives',
					items: [{ text: '@nextvm/natives', link: '/packages/natives' }],
				},
				{
					text: 'Layer 3 — Core',
					items: [
						{ text: '@nextvm/core', link: '/packages/core' },
						{ text: '@nextvm/db', link: '/packages/db' },
						{ text: '@nextvm/i18n', link: '/packages/i18n' },
						{ text: '@nextvm/test-utils', link: '/packages/test-utils' },
					],
				},
				{
					text: 'Layer 4 — Runtime',
					items: [
						{ text: '@nextvm/runtime-server', link: '/packages/runtime-server' },
						{ text: '@nextvm/runtime-client', link: '/packages/runtime-client' },
						{ text: '@nextvm/nui', link: '/packages/nui' },
						{ text: '@nextvm/nui-react', link: '/packages/nui-react' },
						{ text: '@nextvm/voice', link: '/packages/voice' },
					],
				},
				{
					text: 'Layer 3 Tooling',
					items: [
						{ text: '@nextvm/build', link: '/packages/build' },
						{ text: '@nextvm/cli', link: '/packages/cli' },
						{ text: '@nextvm/vite-plugin-nui', link: '/packages/vite-plugin-nui' },
					],
				},
				{
					text: 'Layer 3 Integrations',
					items: [
						{ text: '@nextvm/discord', link: '/packages/discord' },
						{ text: '@nextvm/compat', link: '/packages/compat' },
						{ text: '@nextvm/tebex', link: '/packages/tebex' },
						{ text: '@nextvm/registry', link: '/packages/registry' },
						{ text: '@nextvm/migration', link: '/packages/migration' },
					],
				},
			],

			'/modules/': [
				{
					text: 'First-Party Modules',
					items: [
						{ text: '@nextvm/player', link: '/modules/player' },
						{ text: '@nextvm/vehicle', link: '/modules/vehicle' },
						{ text: '@nextvm/inventory', link: '/modules/inventory' },
						{ text: '@nextvm/banking', link: '/modules/banking' },
						{ text: '@nextvm/jobs', link: '/modules/jobs' },
						{ text: '@nextvm/housing', link: '/modules/housing' },
					],
				},
			],

			'/cli/': [
				{
					text: 'Project',
					items: [
						{ text: 'create', link: '/cli/create' },
						{ text: 'add', link: '/cli/add' },
						{ text: 'validate', link: '/cli/validate' },
						{ text: 'docs', link: '/cli/docs' },
					],
				},
				{
					text: 'Build & Dev',
					items: [
						{ text: 'build', link: '/cli/build' },
						{ text: 'dev', link: '/cli/dev' },
					],
				},
				{
					text: 'Database',
					items: [{ text: 'db', link: '/cli/db' }],
				},
				{
					text: 'Migration',
					items: [{ text: 'migrate:from', link: '/cli/migrate-from' }],
				},
				{
					text: 'Marketplace',
					items: [{ text: 'registry', link: '/cli/registry' }],
				},
				{
					text: 'Operations',
					items: [
						{ text: 'deploy', link: '/cli/deploy' },
						{ text: 'perf', link: '/cli/perf' },
					],
				},
			],

			'/reference/': [
				{
					text: 'Reference',
					items: [
						{ text: 'PLA Compliance', link: '/reference/pla' },
						{ text: 'Glossary', link: '/reference/glossary' },
					],
				},
			],
		},

		socialLinks: [{ icon: 'github', link: 'https://github.com/nextvm-official/nextvm' }],

		footer: {
			message: 'Released under the LGPL-3.0 License.',
			copyright: 'Copyright © 2026 NextVM',
		},

		search: {
			provider: 'local',
		},
	},
})
