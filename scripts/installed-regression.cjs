#!/usr/bin/env node
'use strict'
// No AI calls. Writes go through the installed Companion viewer/shared Editor;
// verification reads native Designer objects independently. No mutation retries.
const fs = require('node:fs/promises'),
  path = require('node:path'),
  assert = require('node:assert/strict')
const { decodeExecution } = require('../src/designer-api')
const args = process.argv.slice(2)
const option = (name, fallback) =>
  args.find((a) => a.startsWith('--' + name + '='))?.slice(name.length + 3) || fallback
const normalize = (name) =>
  String(name)
    .split(/[\\/]/)
    .at(-1)
    .replace(/\.apx$/i, '')
    .toLowerCase()
const close = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-5
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
function address(value) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw Error('Invalid service URL')
  return url
}
async function main() {
  if (!args.includes('--run')) {
    console.log(
      'Usage: node scripts/installed-regression.cjs --run --viewer=http://companion-host:8765 --designer=http://designer-host:80 --track=TESTI2 [--report=.tools/installed-report.json]',
    )
    return
  }
  if (!option('viewer') || !option('designer')) throw Error('Supply --viewer and --designer explicitly')
  const viewer = address(option('viewer')),
    designer = address(option('designer')),
    trackName = option('track', 'TESTI2')
  const reportPath = path.resolve(option('report', '.tools/installed-report.json'))
  const runId = 'DLE TEST ' + new Date().toISOString().replace(/[:.]/g, '-')
  const report = {
    version: require('../package.json').version,
    runId,
    aiCalls: 0,
    checks: [],
    created: [],
    limitations: [
      'Finite scenarios, not every possible track or native layer type',
      'No physical Stream Deck, pixel/audio-output or browser FPS certification',
      'Installed shared actions and viewer endpoints are tested; DOM gestures have separate offline tests',
      'Track tempo, original layers and source media are not modified',
    ],
  }
  let trackUid, session, original, latest
  const owned = new Set(),
    started = Date.now()
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  const save = () =>
    fs.writeFile(reportPath, JSON.stringify({ ...report, elapsedMs: Date.now() - started }, null, 2) + '\n')
  async function get(route) {
    const r = await fetch(new URL(route, viewer), { signal: AbortSignal.timeout(15000) })
    if (!r.ok) throw Error('Viewer read HTTP ' + r.status)
    return r.json()
  }
  async function live() {
    const v = await get('/api/live')
    if (trackUid && v.trackUid !== trackUid) throw Error('Active track changed; no further writes')
    latest = v
    return v
  }
  async function snapshot() {
    const s = await get(
      '/api/state?allDetails=1&width=1200&expanded=' + encodeURIComponent([...owned].join(',')),
    )
    if (trackUid && s.trackUid !== trackUid) throw Error('Active track changed')
    return s
  }
  async function post(route, body, reject = false) {
    await live()
    const r = await fetch(new URL(route, viewer), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Viewer-Token': session },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    })
    const result = await r.json()
    if (reject) {
      assert.ok(!r.ok || result.ok === false, 'Expected write rejection')
      return result
    }
    if (!r.ok || !result.ok) throw Error(result.reason || 'Write HTTP ' + r.status)
    return result
  }
  async function edit(action, options = {}, reject = false) {
    const v = await live()
    return post('/api/edit', { action, token: v.editor.token, ...options }, reject)
  }
  async function release() {
    for (let i = 0; i < 8; i++) {
      const e = (await live()).editor
      if (e.clearPrompt || e.clearMenu) await edit('pad', { slot: 7 })
      else if (e.mediaMode) await edit('media')
      else if (e.moveKey) await edit('key_move')
      else if (e.layerEdit) await edit('layer_edit')
      else return
    }
    throw Error('Could not release edit mode')
  }
  async function readNative(fields = {}) {
    const v = await live()
    const payload = Buffer.from(JSON.stringify({ trackUid, time: v.editor.editTime, fields })).toString(
      'base64',
    )
    const script = (await fs.readFile(path.join(__dirname, 'installed-oracle.py'), 'utf8')).replace(
      '__REQUEST__',
      payload,
    )
    const r = await fetch(new URL('/api/session/python/execute', designer), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
      signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) throw Error('Native read HTTP ' + r.status)
    return decodeExecution(await r.json())
  }
  async function check(name, fn) {
    const at = Date.now()
    try {
      await fn()
      report.checks.push({ name, status: 'PASS', elapsedMs: Date.now() - at })
    } catch (error) {
      report.checks.push({ name, status: 'FAIL', detail: error.message, elapsedMs: Date.now() - at })
    }
    await save()
  }
  function skip(name, detail) {
    report.checks.push({ name, status: 'SKIP', detail })
  }
  async function waitRead(fn) {
    let error
    for (let i = 0; i < 12; i++) {
      try {
        return await fn()
      } catch (e) {
        error = e
        await sleep(200)
      }
    }
    throw error
  }
  async function layer(uid) {
    assert.ok(owned.has(uid), 'Refusing to mutate a non-test layer')
    const s = await snapshot()
    const l = s.layers.find((l) => l.uid === uid)
    assert.ok(l, 'Test layer missing')
    return l
  }
  async function select(uid, parameter, point = 'in', keyTime) {
    await layer(uid)
    await release()
    return post('/api/select', {
      trackUid,
      layerUid: uid,
      ...(parameter ? { parameter } : {}),
      point,
      ...(point === 'key' ? { keyTime } : {}),
    })
  }
  const fieldsOf = (l) => [
    ...new Map(
      [...(l.fields || []), ...(l.resources || []), ...(l.allParameters || [])].map((f) => [f.name, f]),
    ).values(),
  ]
  async function sync(uid) {
    return waitRead(async () => {
      // Group rows aggregate child markers for display; they are not native fields.
      const l = await layer(uid),
        fields = l.group ? [] : fieldsOf(l).filter((f) => !f.unsupported)
      const native = await readNative({ [uid]: fields.map((f) => f.name) }),
        n = native.layers.find((l) => l.uid === uid)
      assert.ok(n)
      assert.equal(l.name, n.name)
      assert.ok(close(l.start, n.start) && close(l.end, n.end), 'Layer bounds differ')
      assert.equal(l.parent || null, n.parent || null, 'Hierarchy differs')
      for (const f of fields) {
        const raw = n.fields.find((r) => r.name === f.name)
        if (!raw) continue
        assert.equal(Boolean(f.sequenced), raw.sequenced, 'Sequencing differs: ' + f.name)
        if (!raw.sequenced) continue
        const visible = raw.keys.filter((k) => k.time >= n.start - 1e-7 && k.time <= n.end + 1e-7)
        const shown = (f.keys || []).filter((k) => k.time >= n.start - 1e-7 && k.time <= n.end + 1e-7)
        assert.equal(shown.length, visible.length, 'Key count differs: ' + f.name)
        for (let i = 0; i < shown.length; i++) {
          assert.ok(close(shown[i].time, visible[i].time), 'Key time differs: ' + f.name)
          if (raw.resource)
            assert.equal(
              shown[i].resource?.uid || shown[i].resourceUid || '',
              visible[i].resourceUid,
              'Resource differs',
            )
          else {
            assert.ok(close(shown[i].value, visible[i].value), 'Value differs: ' + f.name)
            if (shown[i].interpolation !== undefined)
              assert.equal(shown[i].interpolation, visible[i].interpolation)
          }
        }
      }
      return { layer: l, native: n }
    })
  }
  async function manage(uid, operation, extra = {}) {
    const l = await layer(uid)
    await release()
    return edit('layer_manage', {
      trackUid,
      layerUid: uid,
      operation,
      expectedName: l.name,
      expectedStart: l.start,
      expectedEnd: l.end,
      ...extra,
    })
  }
  async function register(uid, kind) {
    assert.ok(uid && !original.layers.some((l) => l.uid === uid), 'Creation did not return a new layer')
    owned.add(uid)
    report.created.push({ uid, kind })
    await save()
    return uid
  }
  async function create(kind, at) {
    await release()
    const before = await readNative()
    let writeError
    try {
      await edit('layer_manage', { operation: 'create', trackUid, kind, targetTime: at })
    } catch (error) {
      writeError = error
    }
    const after = await readNative(),
      fresh = after.layers.filter((l) => !before.layers.some((p) => p.uid === l.uid))
    // A failed selection response can follow successful native creation. Journal
    // the result before reporting it; never retry an ambiguous create.
    for (const l of fresh) await register(l.uid, kind)
    if (writeError) throw writeError
    assert.equal(fresh.length, 1, 'Expected one new layer')
    const uid = fresh[0].uid
    await manage(uid, 'rename', { name: runId + ' ' + kind.toUpperCase() })
    await sync(uid)
    return uid
  }
  async function chooseKey(uid, name, time) {
    await select(uid, name, 'key', time)
    await edit('key_move', { keyTime: time })
    return (await live()).editor.moveKey
  }
  async function assertKey(uid, name, time, value) {
    const n = await readNative({ [uid]: [name] }),
      f = n.layers.find((l) => l.uid === uid).fields[0]
    const k = f.keys.find((k) => close(k.time, time))
    assert.ok(k, 'Native key missing')
    if (value !== undefined) assert.ok(close(k.value, value), 'Native value differs')
    return f
  }
  let fixtures = []
  try {
    const s = await snapshot()
    assert.equal(
      normalize(s.trackName),
      normalize(trackName),
      'Select the requested test track in Designer first',
    )
    assert.ok(s.connected && s.editEnabled && !s.viewOnly, 'Viewer must be connected, LIVE and edit-enabled')
    trackUid = s.trackUid
    session = s.selectionToken
    original = { ...(await readNative()), editor: s.editor }
    assert.ok(original.length > 30, 'Test track must be longer than 30 seconds')
    await release()
    await edit('transport', { operation: 'stop' })
    await edit('link_time', { enabled: false })
    for (const [i, kind] of ['video', 'audio', 'bitmap'].entries()) {
      let uid, name
      await check(kind + '/create', async () => {
        uid = await create(kind, 10 + i * 3)
        fixtures.push(uid)
      })
      if (!uid) continue
      await check(kind + '/numeric-default-and-precision', async () => {
        const l = await layer(uid)
        const f =
          fieldsOf(l).find(
            (f) => new RegExp(kind === 'audio' ? 'volume' : 'brightness', 'i').test(f.name) && !f.resource,
          ) || l.fields.find((f) => Number.isFinite(f.value) && !f.choices?.length)
        assert.ok(f, 'Numeric field unavailable')
        name = f.name
        await select(uid, name)
        let value = Number.isFinite(f.min) && Number.isFinite(f.max) ? f.min + (f.max - f.min) * 0.3 : f.value
        await edit('value_set', { expectedValue: f.value, targetValue: value })
        for (let i = 0; i < 3; i++) {
          await edit('fine')
          await edit('value', { direction: 1 })
          await sync(uid)
        }
      })
      if (name) {
        await check(kind + '/keys-types-move-and-values', async () => {
          const l = await layer(uid),
            duration = l.end - l.start
          for (const fraction of [0.2, 0.5, 0.8]) {
            await release()
            await edit('key_insert', {
              trackUid,
              layerUid: uid,
              parameter: name,
              targetTime: l.start + duration * fraction,
            })
            await edit('drag_value', { targetValue: 0.25 + fraction * 0.5 })
            await sync(uid)
          }
          const f = (await layer(uid)).fields.find((f) => f.name === name)
          assert.ok(f.keys.length >= 3)
          await chooseKey(uid, name, f.keys[1].time)
          for (const type of [0, 1, 2]) {
            await edit('key_type', { type })
            await sync(uid)
          }
          const result = await edit('drag_time', {
            mode: 'key',
            targetTime: f.keys[1].time + 0.1,
            snap: false,
            targetValue: 0.7,
          })
          await assertKey(uid, name, result.editor.moveKey.time, 0.7)
          await sync(uid)
        })
        await check(kind + '/multiple-keys-and-boundaries', async () => {
          const l = await layer(uid),
            f = l.fields.find((f) => f.name === name)
          await select(uid, name)
          await edit('key_group_select', { times: f.keys.slice(0, 2).map((k) => k.time) })
          const old = (await live()).editor.moveKey.group,
            delta = 0.2
          const result = await edit('drag_time', {
            mode: 'key',
            anchorTime: old[1].time,
            targetTime: old[1].time + delta,
            snap: false,
          })
          const moved = result.editor.moveKey.group,
            shift = moved[0].time - old[0].time
          assert.ok(close(moved[1].time - old[1].time, shift), 'Group spacing changed')
          await sync(uid)
          await edit('drag_value', { targetValue: 0 }, true)
          await release()
          const last = (await layer(uid)).fields.find((f) => f.name === name).keys.at(-1)
          await chooseKey(uid, name, last.time)
          const end = await edit('drag_time', { mode: 'key', targetTime: l.end, snap: false })
          assert.ok(close(end.editor.moveKey.time, l.end))
          await sync(uid)
          await edit('drag_time', { mode: 'key', targetTime: l.end + 2, snap: false })
          assert.ok((await live()).editor.moveKey.time <= l.end + 1e-7)
        })
        await check(kind + '/shared-layer-encoders-and-absolute-timing', async () => {
          await select(uid, name)
          await edit('layer_edit')
          for (const action of ['layer', 'field', 'value']) {
            await edit(action, { direction: 1 })
            await sync(uid)
          }
          const l = await layer(uid)
          for (const [mode, targetTime] of [
            ['move', l.start + 1],
            ['in', l.start + 1.1],
            ['out', l.end + 0.5],
          ]) {
            await edit('drag_time', { mode, targetTime, snap: false })
            await sync(uid)
          }
          await release()
        })
        await check(kind + '/unlink-keeps-native-time', async () => {
          await edit('link_time', { enabled: false })
          const before = (await readNative()).time
          await select(uid, name)
          await edit('time', { direction: 1 })
          await sync(uid)
          assert.ok(close((await readNative()).time, before), 'Unlinked edit changed playback time')
        })
        await check(kind + '/selection-navigation-and-clear', async () => {
          await select(uid, name)
          await edit('key', { direction: 1 })
          await edit('key', { direction: -1 })
          const f = (await layer(uid)).fields.find((f) => f.name === name)
          await chooseKey(uid, name, f.keys[0].time)
          await edit('key_delete')
          await sync(uid)
          await select(uid, name)
          await edit('parameter_sequence', {
            parameter: name,
            mode: 'clear',
            expectedSequenced: true,
            confirmed: true,
          })
          await sync(uid)
          await select(uid, name)
          await edit('parameter_sequence', {
            parameter: name,
            mode: 'reset',
            expectedSequenced: false,
            confirmed: true,
          })
          await sync(uid)
        })
      }
      await check(kind + '/choice-field', async () => {
        const l = await layer(uid),
          f = fieldsOf(l).find((f) => f.choices?.length > 1)
        if (!f) {
          skip(kind + '/choice-coverage', 'No choice field available')
          return
        }
        await select(uid, f.name)
        await edit('value_set', { expectedValue: f.value, targetValue: f.choices.at(-1).value })
        await sync(uid)
      })
      await check(kind + '/resource-assignment-and-keys', async () => {
        const l = await layer(uid),
          f = l.resources?.find((f) => f.canAnimate !== false && !/mapping|output|palette/i.test(f.name))
        if (!f) {
          skip(kind + '/resource-coverage', 'No compatible resource parameter')
          return
        }
        await select(uid, f.name)
        if (!(await live()).editor.mediaMode) await edit('media')
        let listing = await get('/api/resource-list?offset=0')
        if (!listing.items?.length) {
          const folders = (await live()).editor.folders
          for (let index = 0; index < folders.length && !listing.items?.length; index++) {
            await edit('resource_folder', { index })
            listing = await get('/api/resource-list?offset=0')
          }
        }
        const media = listing.items?.[0]
        if (!media) {
          skip(kind + '/resource-coverage', 'No compatible project media')
          await release()
          return
        }
        await edit('resource_choose', { index: media.index, resourceUid: media.uid })
        await sync(uid)
        await select(uid, f.name)
        if (!(await live()).editor.mediaMode) await edit('media')
        await edit('layer_press')
        await edit('time', { direction: 1 })
        const list = await get('/api/resource-list?offset=0'),
          item = list.items.find((r) => r.uid === media.uid) || list.items[0]
        assert.ok(item)
        await edit('resource_choose', { index: item.index, resourceUid: item.uid })
        await sync(uid)
        const updated = (await layer(uid)).resources.find((r) => r.name === f.name)
        if (updated.sequenced && updated.keys.length) {
          await chooseKey(uid, f.name, updated.keys.at(-1).time)
          if ((await live()).editor.mediaMode) await edit('media')
          await edit('drag_time', {
            mode: 'key',
            targetTime: Math.min(l.end, updated.keys.at(-1).time + 0.2),
            snap: false,
          })
          await sync(uid)
        } else throw Error('Resource key was not created')
        await release()
      })
      await check(kind + '/duplicate-fit-delete', async () => {
        const before = await readNative()
        await manage(uid, 'duplicate')
        const after = await readNative()
        const copies = after.layers.filter((l) => !before.layers.some((o) => o.uid === l.uid))
        assert.equal(copies.length, 1)
        const copy = await register(copies[0].uid, kind + ' duplicate')
        await sync(copy)
        // Fit is media-dependent: absent media is reported rather than guessed.
        const l = await layer(copy),
          media = l.resources
            ?.map((r) => r.current)
            .find((r) => Number.isFinite(r?.duration) && r.duration > 0)
        if (media) {
          await manage(copy, 'fit')
          await sync(copy)
        } else skip(kind + '/fit-coverage', 'No finite-duration media assigned')
        await manage(copy, 'delete')
        assert.ok(!(await readNative()).layers.some((l) => l.uid === copy))
      })
    }
    if (fixtures.length >= 2) {
      await check('layers/reorder', async () => {
        await release()
        const s = await snapshot(),
          a = await layer(fixtures[0]),
          b = await layer(fixtures[1])
        await edit('layer_reorder', {
          trackUid,
          layerUid: a.uid,
          targetUid: b.uid,
          after: true,
          expectedOrder: s.layers.filter((l) => !l.parent).map((l) => l.uid),
        })
        const n = await readNative()
        assert.ok(n.layers.findIndex((l) => l.uid === a.uid) > n.layers.findIndex((l) => l.uid === b.uid))
        await sync(a.uid)
      })
      await check('layers/group-move-ungroup', async () => {
        await release()
        const s = await snapshot(),
          members = fixtures.map((uid) => s.layers.find((l) => l.uid === uid))
        const result = await edit('layer_group', {
          operation: 'group',
          trackUid,
          name: runId + ' GROUP',
          layers: members.map((l) => ({ uid: l.uid, name: l.name, start: l.start, end: l.end })),
          expectedOrder: s.layers.filter((l) => !l.parent).map((l) => l.uid),
        })
        const groupUid = await register(result.hierarchy.groupUid, 'group')
        await sync(groupUid)
        const before = await readNative(),
          group = before.layers.find((l) => l.uid === groupUid),
          children = before.layers.filter((l) => l.parent === groupUid)
        assert.equal(children.length, members.length)
        await edit('group_move', {
          trackUid,
          layerUid: groupUid,
          members: [group, ...children].map((l) => ({ uid: l.uid, start: l.start, end: l.end })),
          targetTime: group.start + 1,
          snap: false,
        })
        for (const uid of fixtures) await sync(uid)
        const moved = await layer(groupUid)
        await edit('layer_group', {
          operation: 'ungroup',
          trackUid,
          layers: [{ uid: groupUid, name: moved.name, start: moved.start, end: moved.end }],
          expectedOrder: (await snapshot()).layers.filter((l) => !l.parent).map((l) => l.uid),
          expectedChildren: children.map((l) => l.uid),
        })
        assert.ok(!(await readNative()).layers.some((l) => l.uid === groupUid))
        for (const uid of fixtures) await sync(uid)
      })
    }
    await check('safety/view-only-and-stale-request', async () => {
      await release()
      const before = await readNative()
      await post('/api/view-mode', { viewOnly: true })
      try {
        await edit('layer_manage', { operation: 'create', trackUid, kind: 'video', targetTime: 1 }, true)
        assert.equal((await readNative()).layers.length, before.layers.length)
      } finally {
        await post('/api/view-mode', { viewOnly: false })
      }
      await post(
        '/api/edit',
        {
          action: 'layer_manage',
          token: '0'.repeat(64),
          operation: 'create',
          trackUid,
          kind: 'video',
          targetTime: 1,
        },
        true,
      )
    })
  } catch (error) {
    report.checks.push({ name: 'preflight-or-suite', status: 'FAIL', detail: error.message })
  } finally {
    if (original && trackUid) {
      await check('restore-and-preserve-original-layers', async () => {
        await release()
        await edit('link_time', { enabled: true })
        await post('/api/seek', { trackUid, time: original.time })
        await edit('link_time', { enabled: original.editor.linkTime })
        const current = await readNative()
        for (const old of original.layers) {
          const now = current.layers.find((l) => l.uid === old.uid)
          assert.ok(now, 'Original layer missing')
          assert.equal(now.name, old.name)
          assert.equal(now.parent, old.parent)
          assert.ok(close(now.start, old.start) && close(now.end, old.end), 'Original layer timing changed')
        }
      })
    }
    report.counts = Object.fromEntries(
      ['PASS', 'FAIL', 'SKIP'].map((status) => [
        status,
        report.checks.filter((c) => c.status === status).length,
      ]),
    )
    await save()
    console.log(
      JSON.stringify({
        counts: report.counts,
        elapsedMs: Date.now() - started,
        aiCalls: 0,
        report: reportPath,
      }),
    )
    for (const check of report.checks)
      if (check.status !== 'PASS') console.log(check.status, check.name, check.detail || '')
    if (report.counts.FAIL) process.exitCode = 1
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
module.exports = { normalize, address, close }
