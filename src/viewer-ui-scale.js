'use strict'

// CSS zoom scales painting, including fixed menus, but pointer events and DOM
// rects arrive in viewport pixels. Keep editing geometry in unzoomed CSS pixels.
// This also keeps offsetTop, scrollTop and clientWidth in the same coordinate space.
function createUiGeometry(getScale, viewport) {
  const local = value => value / getScale()
  return {
    x: event => local(event.clientX),
    y: event => local(event.clientY),
    width: () => local(viewport.innerWidth),
    height: () => local(viewport.innerHeight),
    rect: node => {
      const rect = node.getBoundingClientRect()
      return Object.fromEntries(['x','y','left','top','right','bottom','width','height'].map(key => [key,local(rect[key])]))
    },
  }
}
module.exports = { createUiGeometry }
