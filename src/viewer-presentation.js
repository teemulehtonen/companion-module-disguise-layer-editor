'use strict'

// Presentation transactions never touch project/editor state. Acknowledged
// previews survive redraws until a fresh snapshot supplies the native result.
function createPresentationQueue() {
  let entries=[]
  function undo() {
    for(const entry of [...entries].reverse()) { entry.undo?.(); entry.undo=null }
  }
  function paint() {
    undo()
    for(const entry of entries) entry.undo=entry.apply() || null
  }
  return {
    begin(apply) {
      const entry={apply,undo:null}
      entries.push(entry)
      try { paint() } catch(error) { undo();entries=entries.filter(item=>item!==entry);throw error }
      let finished=false
      return accepted=>{
        if(finished)return
        finished=true
        if(!accepted){undo();entries=entries.filter(item=>item!==entry);paint()}
      }
    },
    paint,
    unpaint:undo,
    clear(){undo();entries=[]},
    get size(){return entries.length},
  }
}

module.exports={createPresentationQueue}
