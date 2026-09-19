'use strict'

// Single entry point for the runtime SDK. If Companion changes its instance
// lifecycle or feedback API, adapt it here and in main.js, not in Editor.
const { InstanceBase, InstanceStatus, combineRgb } = require('@companion-module/base')
module.exports = { InstanceBase, InstanceStatus, combineRgb }
