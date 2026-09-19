'use strict'

const sample = () => ({
  trackUid: 'demo-track',
  transportUid: 'demo-transport',
  trackName: 'Demo / Main',
  time: 0,
  fps: 25,
  length: 120,
  layers: [
    {
      uid: 'demo-1',
      name: 'Background',
      start: 0,
      end: 120,
      mediaFields: [{ name: 'video', label: 'Video' }],
      fields: [
        {
          name: 'brightness',
          value: 0.5,
          sequenced: true,
          keys: [
            { time: 0, value: 0.5 },
            { time: 5, value: 1 },
            { time: 10, value: 0 },
          ],
        },
        { name: 'speed', value: 1, sequenced: false, keys: [{ time: 0, value: 1 }] },
      ],
    },
    {
      uid: 'demo-2',
      name: 'Foreground',
      fields: [{ name: 'brightness', value: 1, sequenced: false, keys: [{ time: 0, value: 1 }] }],
    },
  ],
})

class DemoClient {
  constructor() {
    this.data = sample()
    for (const l of this.data.layers)
      for (const f of l.fields) {
        f.label = f.name[0].toUpperCase() + f.name.slice(1)
        f.step = 0.01
        f.canAnimate = true
        for (const k of f.keys) k.interpolation = 2
      }
  }
  close() {}
  async togglePlayback() {
    this.playing = !this.playing
    return { playing: this.playing }
  }
  async thumbnail() {
    return ''
  }
  async execute(command, args = {}) {
    if (command === 'refresh') return structuredClone(this.data)
    if (command === 'live_state')
      return structuredClone({
        timeline: {
          trackUid: this.data.trackUid,
          time: this.data.time,
          selectedLayerUids: this.data.selectedLayerUids || [],
          layers: this.data.layers.map((l) => ({
            uid: l.uid,
            start: l.start ?? 0,
            end: l.end ?? this.data.length,
          })),
        },
      })
    if (command === 'seek') {
      this.data.time = args.time
      return { time: args.time }
    }
    if (command === 'nudge_time') {
      const current = args.cursor ?? this.data.time
      this.data.time = Math.max(
        0,
        Math.min(
          this.data.length,
          args.frames
            ? (Math.round(current * this.data.fps) + args.delta) / this.data.fps
            : current + args.delta,
        ),
      )
      return { time: this.data.time }
    }
    if (command === 'media_list' || command === 'media_set' || command === 'media_key_set')
      return { media: [], selectedUid: '' }
    const layer = this.data.layers.find((l) => l.uid === args.layerUid)
    if (command === 'parameter_default') {
      const f = [...layer.fields, ...(layer.mediaFields || [])].find((f) => f.name === args.field)
      if (!f || f.sequenced || f.keys?.length > 1)
        throw new Error('Parameter is now animated; confirm deletion')
      if (!Object.hasOwn(f, 'defaultValue')) throw new Error('Default value unavailable')
      f.value = f.defaultValue
      f.keys = [{ time: layer.start, value: f.defaultValue }]
      return {}
    }
    if (command === 'key_clear_list' || command === 'keys_clear' || command === 'layer_default') {
      const fields = [...layer.fields, ...(layer.mediaFields || [])]
      if (command === 'layer_default') {
        args = { ...args, fields: fields.map((f) => f.name), resetDefault: true }
      }
      if (command === 'key_clear_list')
        return {
          items: fields
            .filter((f) => f.keys?.length > 1 || (f.sequenced && f.keys?.length))
            .map((f) => ({
              name: f.name,
              label: f.label || f.name,
              kind: layer.fields.includes(f) ? 'VALUE' : 'RESOURCE',
              keyCount: f.keys.length,
            })),
        }
      if (args.confirmed !== true || !args.fields?.length)
        throw new Error('Select parameters and confirm before clearing')
      const targets = args.fields.map((name) => fields.find((f) => f.name === name))
      if (
        targets.some(
          (f) => !f || (!args.resetDefault && (!f.keys?.length || (!f.sequenced && f.keys.length === 1))),
        )
      )
        throw new Error('Parameter animation changed; reopen CLEAR KEYS')
      if (args.resetDefault && targets.some((f) => !Object.hasOwn(f, 'defaultValue')))
        throw new Error('Default value unavailable')
      for (const f of targets) {
        if (args.resetDefault) {
          if (layer.fields.includes(f)) f.value = f.defaultValue
          else f.resourceUid = f.defaultValue
        }
        f.keys = [
          {
            ...f.keys?.[0],
            time: layer.start,
            ...(layer.fields.includes(f) ? { value: f.value } : { resourceUid: f.resourceUid }),
          },
        ]
        f.sequenced = false
      }
      return { cleared: args.fields }
    }
    if (command === 'layer_edit') {
      if (!layer || layer.start !== args.expectedStart || layer.end !== args.expectedEnd)
        throw new Error('Layer timing changed')
      if (args.mode === 'fit') throw new Error('Demo content has no duration for FIT')
      const origin = args.mode === 'out' ? layer.end : layer.start
      const target = args.frames
        ? (Math.round(origin * this.data.fps) + args.delta) / this.data.fps
        : origin + args.delta
      const minimum = 1 / this.data.fps,
        limit = this.data.length
      const length = Math.min(limit, Math.max(minimum, layer.end - layer.start))
      const start =
        args.mode === 'move'
          ? Math.max(0, Math.min(limit - length, target))
          : args.mode === 'in'
            ? Math.max(0, Math.min(Math.min(limit, layer.end) - minimum, target))
            : Math.max(0, Math.min(limit - minimum, layer.start))
      const end =
        args.mode === 'move'
          ? start + length
          : args.mode === 'out'
            ? Math.max(start + minimum, Math.min(limit, target))
            : Math.max(minimum, Math.min(limit, layer.end))
      const delta = start - layer.start
      if (args.mode === 'move') for (const f of layer.fields) for (const k of f.keys) k.time += delta
      layer.start = start
      layer.end = end
      this.data.time = Math.max(
        start,
        Math.min(end, (args.cursor ?? this.data.time) + (args.mode === 'move' ? delta : 0)),
      )
      return structuredClone({ layer, time: this.data.time })
    }
    const field = layer?.fields.find((f) => f.name === args.field)
    if (!field) throw new Error('Unknown demo parameter')
    if (args.live) args = { ...args, time: this.data.time }
    const result = () =>
      structuredClone({ field, time: this.data.time, keys: field.keys, sequenced: field.sequenced })
    if (command === 'read_field') return result()
    if (command === 'jump_key') {
      const start = layer.start ?? 0,
        end = layer.end ?? this.data.length
      const lastVisible = Math.max(start, end - 1 / this.data.fps)
      const keys = (field.sequenced ? field.keys : [])
        .filter((k) => k.time >= start && k.time <= end)
        .sort((a, b) => a.time - b.time)
      const anchor = args.navigationTime
      const validAnchor =
        anchor != null &&
        [...keys.map((k) => k.time), start, lastVisible].some((t) => Math.abs(t - anchor) < 1e-5)
      const cursor = validAnchor ? anchor : this.data.time
      const k =
        args.direction < 0
          ? keys.filter((k) => k.time < cursor - 1e-5).at(-1)
          : keys.find((k) => k.time > cursor + 1e-5)
      this.data.time = Math.max(start, Math.min(end, k?.time ?? (args.direction < 0 ? start : lastVisible)))
      const exact = keys.find((k) => Math.abs(k.time - this.data.time) < 1e-5)
      if (exact) field.value = exact.value
      return { ...result(), keyTime: exact?.time ?? null, atBoundary: !exact }
    }
    if (command === 'select_key' || command === 'key_type' || command === 'key_move') {
      if (command === 'key_move' && !field.sequenced)
        throw new Error('A constant parameter has no keyframe to move')
      const k =
        command === 'select_key'
          ? field.keys
              .filter(
                (k) =>
                  !field.sequenced ||
                  (k.time >= (layer.start ?? 0) && k.time <= (layer.end ?? this.data.length)),
              )
              .sort(
                (a, b) =>
                  Math.round(Math.abs(a.time - args.time) * 1e9) -
                    Math.round(Math.abs(b.time - args.time) * 1e9) || b.time - a.time,
              )[0]
          : field.keys.find((k) => Math.abs(k.time - (args.sourceTime ?? args.time)) < 1e-5)
      if (!k) throw new Error('Select an exact keyframe')
      if (command === 'select_key') {
        this.data.time = Math.max(0, Math.min(this.data.length, k.time))
        field.value = k.value
        return { ...result(), selectedKey: structuredClone(k) }
      }
      if (command === 'key_type') k.interpolation = args.type ?? (k.interpolation + 1) % 3
      else {
        if (JSON.stringify(k) !== JSON.stringify(args.expectedKey))
          throw new Error('Selected keyframe changed')
        const target = Math.max(
          layer.start ?? 0,
          Math.min(
            layer.end ?? this.data.length,
            this.data.length,
            args.frames
              ? (Math.round(k.time * this.data.fps) + args.delta) / this.data.fps
              : k.time + args.delta,
          ),
        )
        if (field.keys.some((other) => other !== k && Math.abs(other.time - target) < 1e-5)) return result()
        if (target < 0 || target > this.data.length) throw new Error('Invalid keyframe destination')
        k.time = target
        this.data.time = target
        field.keys.sort((a, b) => a.time - b.time)
      }
      return result()
    }
    if (command === 'adjust_value') {
      const selected =
        !field.sequenced || field.keys.length === 1
          ? field.keys[0]
          : field.keys.find((k) => Math.abs(k.time - args.keyTime) < 1e-5)
      if (!selected) throw new Error('Selected keyframe is missing')
      if (field.choices?.length) {
        const i = field.choices.findIndex((c) => c.value === selected.value)
        args.value = field.choices[Math.max(0, Math.min(field.choices.length - 1, i + args.direction))].value
      } else {
        const step =
          (args.step || (field.integer ? field.step || 1 : 0.1)) /
          (field.integer ? 1 : args.precision === 'ultra' ? 100 : args.fine ? 10 : 1)
        args.value = Number(
          Math.max(
            field.min ?? -Infinity,
            Math.min(
              field.max ?? Infinity,
              selected.value + args.direction * (field.integer ? Math.max(1, Math.round(step)) : step),
            ),
          ).toPrecision(12),
        )
      }
      selected.value = args.value
      field.value = args.value
      return result()
    }
    const index = field.keys.findIndex(
      (k) => Math.abs(k.time - (command === 'key_delete' ? (args.keyTime ?? args.time) : args.time)) < 1e-5,
    )
    if (command === 'key_clear') {
      if (args.confirmed !== true) throw new Error('Clear all keyframes requires confirmation')
      field.keys = [{ ...field.keys[0], value: field.value }]
      field.sequenced = false
      return result()
    }
    if (command === 'constant_set') {
      if (field.sequenced) throw new Error('Animated parameter: use Save keyframe instead')
      field.keys[0].value = args.value
    } else if (command === 'key_set') {
      const key = {
        time: args.time,
        value: args.value,
        interpolation: index < 0 ? 2 : field.keys[index].interpolation,
      }
      if (index < 0) field.keys.push(key)
      else field.keys[index] = key
      field.keys.sort((a, b) => a.time - b.time)
      field.sequenced = true
    } else if (command === 'key_delete') {
      if (index < 0) throw new Error('Select an exact keyframe using Previous/Next key')
      if (field.keys.length <= 1) throw new Error('The last keyframe cannot be removed')
      field.keys.splice(index, 1)
    } else throw new Error('Unknown demo command')
    if (command !== 'key_delete') field.value = args.value
    return result()
  }
}
module.exports = { DemoClient, sample }
