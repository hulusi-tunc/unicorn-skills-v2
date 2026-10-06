#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(import.meta.url)
const moved = resolve(dirname(here), '../../.designkit/scripts', basename(here))
const run = spawnSync(process.execPath, [moved, ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(run.status ?? 1)
