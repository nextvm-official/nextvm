#!/usr/bin/env node
/**
 * NextVM CLI entry point.
 *
 * Concept v2.3, Chapter 17.
 */
import { runCli } from './index'
import { cliLog } from './utils/logger'

runCli(process.argv).catch((err) => {
	cliLog.error(err instanceof Error ? err.message : String(err))
	process.exit(1)
})
