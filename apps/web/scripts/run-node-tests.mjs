#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const nodeTestArgs = args.filter((arg) => arg.startsWith('--'))
const roots = args.filter((arg) => !arg.startsWith('--'))
const searchRoots = roots.length > 0 ? roots : ['src']
const ignoredDirectories = new Set(['node_modules', 'dist', 'test-results'])
const testFiles = []

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue

    const path = join(directory, entry)
    const stats = statSync(path)

    if (stats.isDirectory()) {
      walk(path)
      continue
    }

    if (entry.endsWith('.test.ts')) {
      testFiles.push(path)
    }
  }
}

for (const root of searchRoots) {
  walk(root)
}

testFiles.sort()

if (testFiles.length === 0) {
  console.error(`No .test.ts files found under ${searchRoots.join(', ')}.`)
  process.exit(1)
}

const result = spawnSync(
  process.execPath,
  [
    '--import',
    'tsx',
    '--test',
    ...nodeTestArgs,
    ...testFiles.map((file) => relative(process.cwd(), file)),
  ],
  {
    stdio: 'inherit',
  }
)

process.exit(result.status ?? 1)
