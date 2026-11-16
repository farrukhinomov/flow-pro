#!/usr/bin/env node

const supportedRanges = 'Node.js 20.19+ or 22.13+'
const version = process.versions.node

function parseVersion(value) {
  const [major = '0', minor = '0', patch = '0'] = value
    .replace(/^v/, '')
    .split('.')

  return {
    major: Number.parseInt(major, 10),
    minor: Number.parseInt(minor, 10),
    patch: Number.parseInt(patch, 10),
  }
}

function isAtLeast(current, required) {
  if (current.major !== required.major) return current.major > required.major
  if (current.minor !== required.minor) return current.minor > required.minor

  return current.patch >= required.patch
}

const current = parseVersion(version)
const isSupported =
  (current.major === 20 &&
    isAtLeast(current, { major: 20, minor: 19, patch: 0 })) ||
  isAtLeast(current, { major: 22, minor: 13, patch: 0 })

if (!isSupported) {
  console.error(
    `FlowPro requires ${supportedRanges}. Current runtime is ${version}. Run "nvm use" from the repo root or install the version in .node-version.`
  )
  process.exit(1)
}

console.log(`OK Node.js ${version}`)
