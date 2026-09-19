'use strict'

// Shared neutral dark theme with a cyan accent.
module.exports = Object.freeze({
  name: 'Disguise Layer Editor',
  product: 'Disguise Layer Editor',
  black: 0x000000,
  background: 0x101517,
  surface: 0x172227,
  accent: 0x0699b2,
  text: 0xf9f9fa,
  secondary: 0xc3d0d4,
  active: 0x076878,
  media: 0x11191d,
  danger: 0x391d24,
  keyframe: 0x43e68c,
  groups: Object.freeze({
    navigation: 0x203343,
    keyEdit: 0x303044,
    layer: 0x16383f,
    playback: 0x23392f,
    resources: 0x393328,
  }),
  // Companion sizes text as a percentage of its own element height.
  type: Object.freeze({
    button: 22,
    tool: 20,
    mediaFile: 68,
    mediaFolder: 68,
    title: 80,
    timeTitle: 70,
    value: 74,
    detail: 46,
    indicator: 85,
  }),
})
