#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const clientRoot = resolve(scriptDir, '..')
const repoRoot = resolve(clientRoot, '..', '..')
const requestedVersion = readFileSync(resolve(repoRoot, '.node-version'), 'utf8')
  .trim()
  .replace(/^v/, '')
const bundledNode = resolve(
  process.env.HOME ?? '',
  '.nvm',
  'versions',
  'node',
  `v${requestedVersion}`,
  'bin',
  'node'
)
const command = process.argv[2]
const commandArgs = process.argv.slice(3)

if (!command) {
  console.error('Usage: node scripts/run-with-project-node.mjs <command> [...args]')
  process.exit(1)
}

if (process.versions.node !== requestedVersion && existsSync(bundledNode)) {
  const result = spawn(
    bundledNode,
    [resolve(scriptDir, 'run-with-project-node.mjs'), command, ...commandArgs],
    {
      cwd: clientRoot,
      env: {
        ...process.env,
        PATH: `${resolve(dirname(bundledNode))}:${process.env.PATH ?? ''}`,
      },
      stdio: 'inherit',
    }
  )

  result.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 1)
  })
} else {
  const executable =
    command === 'node'
      ? process.execPath
      : resolve(clientRoot, 'node_modules', '.bin', command)
  const result = spawn(executable, commandArgs, {
    cwd: clientRoot,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })

  result.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 1)
  })
}
