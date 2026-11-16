#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, extname, join, relative } from 'node:path'

const root = process.cwd()
const sourceRoot = join(root, 'src')
const sourceExtensions = new Set(['.ts', '.tsx'])
const ignoredPathParts = new Set(['node_modules', 'dist'])
const ignoredFiles = new Set(['src/routeTree.gen.ts'])
const markerIgnoredPrefixes = ['src/data/sync/']
const largeFileLimit = 700
const routeFileLimit = 900
const markerPatterns = [
  { label: 'TODO/FIXME/HACK', pattern: /\b(TODO|FIXME|HACK)\b/i },
  { label: 'console.log', pattern: /console\.log/ },
  { label: 'template business copy', pattern: /Total Revenue|Subscriptions|Recent Sales|Lorem ipsum|John Doe/ },
  { label: 'demo/mock wording', pattern: /\b(demo|mock|sample)\b/i },
]

function walk(directory) {
  const entries = readdirSync(directory)

  return entries.flatMap((entry) => {
    const absolutePath = join(directory, entry)
    const relativePath = relative(root, absolutePath)
    const stats = statSync(absolutePath)

    if (stats.isDirectory()) {
      if (ignoredPathParts.has(entry)) return []

      return walk(absolutePath)
    }

    if (!sourceExtensions.has(extname(entry))) return []
    if (ignoredFiles.has(relativePath)) return []

    return [absolutePath]
  })
}

function lineCount(content) {
  if (!content) return 0

  return content.split(/\r?\n/).length
}

const files = walk(sourceRoot)
const fileSummaries = files
  .map((file) => {
    const content = readFileSync(file, 'utf8')

    return {
      content,
      lines: lineCount(content),
      path: relative(root, file),
    }
  })
  .sort((a, b) => b.lines - a.lines)

const largeFiles = fileSummaries.filter((file) => file.lines >= largeFileLimit)
const largeRoutes = fileSummaries.filter(
  (file) => file.path.startsWith('src/routes/') && file.lines >= routeFileLimit
)
const filePathSet = new Set(fileSummaries.map((file) => file.path))

function isTypeOnlyDomainFile(filePath) {
  const fileName = basename(filePath)

  return fileName === 'types.ts' || fileName.endsWith('.types.ts')
}

function hasPackageLevelDomainTest(filePath) {
  let currentDir = dirname(filePath)
  const domainRoot = 'src/domain'

  while (currentDir.startsWith(domainRoot) && currentDir !== domainRoot) {
    const parentDir = dirname(currentDir)
    const directoryName = basename(currentDir)
    const packageTestPath = join(parentDir, `${directoryName}.test.ts`)

    if (filePathSet.has(packageTestPath)) {
      return true
    }

    currentDir = parentDir
  }

  return false
}

const domainFilesWithoutTests = fileSummaries.filter((file) => {
  if (!file.path.startsWith('src/domain/')) return false
  if (file.path.endsWith('.test.ts')) return false
  if (isTypeOnlyDomainFile(file.path)) return false

  const expectedTestPath = file.path.replace(/\.ts$/, '.test.ts')

  if (filePathSet.has(expectedTestPath)) return false

  return !hasPackageLevelDomainTest(file.path)
})
const markerHits = markerPatterns.flatMap((marker) =>
  fileSummaries.flatMap((file) => {
    if (markerIgnoredPrefixes.some((prefix) => file.path.startsWith(prefix))) {
      return []
    }

    const lines = file.content.split(/\r?\n/)

    return lines.flatMap((line, index) =>
      marker.pattern.test(line)
        ? [
            {
              label: marker.label,
              line: index + 1,
              path: file.path,
              text: line.trim().slice(0, 120),
            },
          ]
        : []
    )
  })
)

function printSection(title) {
  console.log(`\n${title}`)
  console.log('-'.repeat(title.length))
}

console.log('FlowPro maintenance scan')
console.log(`Scanned ${files.length} source files.`)

printSection('Largest source files')
fileSummaries.slice(0, 12).forEach((file) => {
  console.log(`${String(file.lines).padStart(5)}  ${file.path}`)
})

printSection('Route files to split first')
if (largeRoutes.length === 0) {
  console.log('No route file is above the route split threshold.')
} else {
  largeRoutes.forEach((file) => {
    console.log(`${String(file.lines).padStart(5)}  ${file.path}`)
  })
}

printSection('Domain files without direct tests')
if (domainFilesWithoutTests.length === 0) {
  console.log('Every non-type domain file has a matching *.test.ts file.')
} else {
  domainFilesWithoutTests.forEach((file) => {
    console.log(`${String(file.lines).padStart(5)}  ${file.path}`)
  })
}

printSection('Maintenance markers')
if (markerHits.length === 0) {
  console.log('No obvious template/demo/debug markers found.')
} else {
  markerHits.slice(0, 30).forEach((hit) => {
    console.log(`${hit.path}:${hit.line}  [${hit.label}] ${hit.text}`)
  })

  if (markerHits.length > 30) {
    console.log(`...and ${markerHits.length - 30} more marker hits.`)
  }
}

printSection('Recommended routine')
console.log('1. Run npm run check before pushing changes.')
console.log('2. Run npm run knip after deleting or moving modules.')
console.log('3. Split any route file above 900 lines into feature hooks/components.')
console.log('4. Put write workflows in src/application services.')
console.log('5. Keep domain logic in src/domain and UI state in src/features or routes.')
