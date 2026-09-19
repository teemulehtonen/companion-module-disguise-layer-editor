'use strict'

// A change fingerprint, not a second full viewer snapshot. Float/resource key
// data is evaluated at 500 ms; curves and thumbnails are fetched only on change.
const contentProperty = `str(hash(str([(str(l.uid), l.name, l.tStart, l.tEnd, [(f.name, f.disableSequencing, [(f.sequence.t(i), (f.sequence.key(i).v, f.sequence.key(i).interpolation) if isinstance(f.sequence, FloatSequence) else str(f.sequence.key(i).r.uid) if f.sequence.key(i).r else '') for i in range(f.sequence.nKeys())]) for f in l.fields if isinstance(f.sequence, FloatSequence) or isinstance(f.sequence, ResourceSequence)]) for l in object.track.getLeafLayers(Module)])))`

module.exports = { contentProperty }
