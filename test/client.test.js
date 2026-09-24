'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const { DesignerClient } = require('../src/client')
const { makeScript } = require('../src/designer-script')
const { sample } = require('../src/demo')

test('play toggle reads actual state and sends playsection or stop to the selected transport', async () => {
  for (const playing of [false, true]) {
    const requests = []
    const c = new DesignerClient('localhost', 80, async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) })
      return {
        ok: true,
        json: async () =>
          url.endsWith('/execute')
            ? { status: { code: 0 }, returnValue: JSON.stringify({ playing }) }
            : { status: { code: 0 } },
      }
    })
    assert.deepEqual(await c.togglePlayback({ transportUid: '123', trackUid: '456' }), { playing: !playing })
    assert.equal(requests.length, 2)
    assert.ok(requests[1].url.endsWith(playing ? '/stop' : '/playsection'))
    assert.deepEqual(requests[1].body, { transports: [{ uid: '123' }] })
  }
})

test('HTTP client sends one Python request and parses the nested response', async (t) => {
  let received
  const server = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    received = { method: req.method, path: req.url, body: JSON.parse(Buffer.concat(chunks)) }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ status: { code: 0 }, returnValue: JSON.stringify(sample()) }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const client = new DesignerClient('127.0.0.1', server.address().port)
  const result = await client.execute('refresh')
  assert.equal(result.trackUid, 'demo-track')
  assert.equal(received.method, 'POST')
  assert.equal(received.path, '/api/session/python/execute')
  assert.equal(typeof received.body.script, 'string')
  assert.equal(received.body.moduleName, undefined)
})
test('API errors are not treated as success or retried', async () => {
  let calls = 0
  const client = new DesignerClient('localhost', 80, async () => {
    calls++
    return { ok: true, json: async () => ({ status: { code: 9, message: 'Track changed' } }) }
  })
  await assert.rejects(client.execute('key_set', {}), /Track changed/)
  assert.equal(calls, 1)
})
test('HTTP errors, malformed responses and invalid hosts fail clearly', async () => {
  const client = new DesignerClient('localhost', 80, async () => ({ ok: false, status: 404 }))
  await assert.rejects(client.execute('refresh'), /HTTP 404/)
  const malformed = new DesignerClient('localhost', 80, async () => ({ ok: true, json: async () => ({}) }))
  await assert.rejects(malformed.execute('refresh'), /Invalid Designer API response/)
  assert.throws(() => new DesignerClient('host/path', 80), /hostname/)
  assert.throws(() => new DesignerClient('localhost', 0), /port/)
})
test('transport master uses the official list, brightness and volume endpoints without retries', async () => {
  const requests=[]
  const client=new DesignerClient('localhost',80,async(url,options={})=>{
    requests.push({url,method:options.method||'GET',body:options.body&&JSON.parse(options.body)})
    if(url.endsWith('/transports'))return {ok:true,json:async()=>({status:{code:0},transports:[
      {uid:'123',name:'Music',brightness:0.25,volume:0.75,engaged:true,playmode:'Stop'},
      {uid:'invalid',name:'Ignored',brightness:1,volume:1},
    ]})}
    return {ok:true,json:async()=>({status:{code:0}})}
  })
  assert.deepEqual(await client.listTransports(),[{uid:'123',name:'Music',brightness:0.25,volume:0.75,engaged:true,playmode:'Stop'}])
  await client.setTransportMaster('123',0.375)
  assert.deepEqual(requests.slice(1).map(request=>request.url.split('/').at(-1)).sort(),['brightness','volume'])
  assert.deepEqual(requests.find(request=>request.url.endsWith('/brightness')).body,
    {transports:[{transport:{uid:'123'},brightness:0.375}]})
  assert.deepEqual(requests.find(request=>request.url.endsWith('/volume')).body,
    {transports:[{transport:{uid:'123'},volume:0.375}]})
  assert.equal(requests.length,3)
  await assert.rejects(client.setTransportMaster('bad',0.5),/UID/)
  await assert.rejects(client.setTransportMaster('123',1.1),/level/)
  assert.equal(requests.length,3)
  client.viewOnly=true
  await assert.rejects(client.setTransportMaster('123',0.5),/VIEW ONLY/)
  assert.equal(requests.length,3)
})
test('Python payload safely transports quotes, Unicode and code-like field names', () => {
  const field = "äö'); raise ValueError('injected') #"
  const script = makeScript('key_set', { field, value: 1 })
  assert.ok(!script.includes(field))
  const encoded = script.match(/b64decode\('([^']+)'\)/)[1]
  assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')), {
    command: 'key_set',
    field,
    value: 1,
  })
})
