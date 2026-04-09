/**
 * NextVM project config — Full Stack Example.
 * `projectConfigSchema` in `@nextvm/build`. The CLI commands
 * (`nextvm build`, `nextvm dev`, `nextvm validate`) load this file
 * via jiti and use it to discover modules + runtime config.
 */

export default {
	server: {
		name: 'NextVM Full Stack Example',
		maxPlayers: 32,
		defaultLocale: 'en',
	},
	database: {
		host: process.env.MYSQL_HOST ?? 'localhost',
		port: 3306,
		user: process.env.MYSQL_USER ?? 'root',
		password: process.env.MYSQL_PASSWORD ?? '',
		database: process.env.MYSQL_DB ?? 'nextvm_example',
	},
	// Modules under modules/* are auto-discovered. List them explicitly
	// here to lock the build order or pin a subset.
	modules: [
		'@nextvm/banking',
		'@nextvm/jobs',
		'@nextvm/housing',
		'@nextvm/inventory',
		'@nextvm/player',
		'@nextvm/vehicle',
		'core',
	],
}
