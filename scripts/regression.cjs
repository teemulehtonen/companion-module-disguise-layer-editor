#!/usr/bin/env node
'use strict'
const { spawnSync } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const results = []
const args = process.argv.slice(2)
const option = (name) => args.find((a) => a.startsWith('--' + name + '='))?.slice(name.length + 3)
const { groups, selectTests } = require('./test-plan.cjs')
function run(name, exe, argv) {
  const result = spawnSync(exe, argv, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  results.push({
    name,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status,
    signal: result.signal,
  })
  // Keep full diagnostic output locally, only summarize successful stages.
  return fs.writeFile(
    path.join(root, '.tools', 'regression-' + name + '.log'),
    (result.stdout || '') + (result.stderr || '') + (result.error?.message || ''),
  )
}
async function main() {
  if (args.includes('--list')) {
    console.log('Groups: all, ' + Object.keys(groups).join(', '))
    return
  }
  if (args.includes('--installed')) throw Error('The removed web-editor integration is unavailable in the CC1 build; use offline Companion actions or authorized --native tests')
  const selectedTests = selectTests(await fs.readdir(path.join(root, 'test')), option('group') || 'all')
  await fs.mkdir(path.join(root, '.tools'), { recursive: true })
  await run('unit', process.execPath, ['--test', ...selectedTests.map((f) => path.join('test', f))])
  if (!args.includes('--unit-only'))
    await run(
      'package',
      process.platform === 'win32' ? 'cmd.exe' : 'npm',
      process.platform === 'win32' ? ['/d', '/s', '/c', 'npm run package'] : ['run', 'package'],
    )
  if (args.includes('--native')) {
    await run('native', process.execPath, [
      path.join(__dirname, 'native-regression.cjs'),
      '--run',
      ...args.filter((a) => /^--(?:host|port)=/.test(a)),
    ])
  }
  if (option('companion')) {
    const base = new URL(option('companion'))
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password)
      throw Error('Invalid Companion URL')
    const label = option('label') || 'd3layers'
    try {
      for (const variable of ['last_error', 'time', 'layer_uid']) {
        const response = await fetch(
          new URL('/api/variable/' + encodeURIComponent(label) + '/' + variable + '/value', base),
          { signal: AbortSignal.timeout(5000) },
        )
        if (!response.ok) throw Error('Variable unavailable')
        const value = await response.text()
        const ok =
          variable === 'last_error'
            ? value.trim() === ''
            : variable === 'time'
              ? value.trim() !== '' && Number.isFinite(Number(value))
              : value.trim() !== ''
        results.push({ name: 'companion-' + variable, status: ok ? 'PASS' : 'FAIL' })
      }
    } catch {
      results.push({ name: 'companion-connection', status: 'FAIL' })
    }
  }
  const report = {
    version: require('../package.json').version,
    group: option('group') || 'all',
    selectedTests,
    results,
    aiCalls: 0,
    limitations: [
      'Finite regression suite, not all possible states',
      'Companion hardware probes are read-only',
      'Native tests use detached tracks and block transport commands',
      'No show playback, pixel/audio output or latency certification',
    ],
  }
  await fs.writeFile(path.join(root, '.tools/regression-report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(results))
  if (results.some((r) => r.status === 'FAIL')) process.exitCode = 1
}
main().catch((e) => {
  console.error(e.message)
  process.exitCode = 1
})
