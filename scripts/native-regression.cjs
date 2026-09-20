#!/usr/bin/env node
'use strict'
// Opt-in native integration tests. No AI services, dependencies or private helpers.
const fs = require('node:fs/promises')
const path = require('node:path')
const { makeScript } = require('../src/designer-script')
const { decodeExecution } = require('../src/designer-api')

async function main() {
  if (!process.argv.includes('--run')) {
    console.log('Usage: node scripts/native-regression.cjs --run [--host=127.0.0.1] [--port=80] [--report=path.json]')
    console.log('Runs real native commands on detached temporary tracks inside Designer; never sends transport commands. Requires an enabled Designer Python API. No AI calls.')
    return
  }
  const option = (name, fallback) => process.argv.find(a => a.startsWith('--' + name + '='))?.split('=').slice(1).join('=') || fallback
  const host = option('host', '127.0.0.1'), port = Number(option('port', '80'))
  if (!/^[a-zA-Z0-9.-]+$/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid Designer address')
  const token = 'manager = guisystem.currentTransportManager'
  const generated = makeScript('refresh')
  if (!generated.includes(token)) throw Error('Native command harness needs updating')
  const native = generated.replace(token, 'p.update(test_payload)\n    manager = test_manager')
  const template = await fs.readFile(path.join(__dirname, 'native-regression.py'), 'utf8')
  const script = template.replace('# __NATIVE_COMMAND__', () => native.split('\n').map(line => '    ' + line).join('\n'))
  const started = Date.now()
  const response = await fetch(`http://${host}:${port}/api/session/python/execute`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({script}),
    signal: AbortSignal.timeout(120000),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw Error('Designer HTTP ' + response.status + ': ' + (body.status?.message || 'native execution failed'))
  }
  const result = decodeExecution(await response.json())
  const report = { version: require('../package.json').version, elapsedMs: Date.now()-started, ...result }
  const filename = path.resolve(option('report', '.tools/native-regression-report.json'))
  await fs.mkdir(path.dirname(filename), {recursive:true})
  await fs.writeFile(filename, JSON.stringify(report, null, 2) + '\n')
  for (const item of result.checks) if (item.status !== 'PASS') console.log(item.status, item.name, item.detail || '')
  const counts = Object.fromEntries(['PASS','FAIL','SKIP'].map(status => [status,result.checks.filter(c=>c.status===status).length]))
  console.log(JSON.stringify({ ...counts, elapsedMs: report.elapsedMs }))
  console.log('Report:', filename)
  if (counts.FAIL) process.exitCode = 1
}
main().catch(error => { console.error('Test run failed:', error.message); process.exitCode = 1 })
