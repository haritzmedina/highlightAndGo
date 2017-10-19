const Modes = require('./background/Modes')
const EditManager = require('./contentScript/EditManager')
const ViewManager = require('./contentScript/ViewManager')
const AnnotatorManager = require('./contentScript/AnnotatorManager')

class ContentScript {
  constructor () {
    this.editManager = null
    this.viewManager = null
    this.annotatorManager = null
  }

  init () {
    // Get current mode and call the manager of this mode
    chrome.runtime.sendMessage({scope: 'extension', cmd: 'getCurrentMode'}, (currentMode) => {
      console.debug(currentMode)
      if (currentMode.id === Modes.original.id) {
        // Nothing to do
      } else if (currentMode.id === Modes.edit.id) {
        // Call edit content script
        this.editManager = new EditManager()
        this.editManager.init()
      } else if (currentMode.id === Modes.view.id) {
        // Call edit content script
        this.viewManager = new ViewManager()
        this.viewManager.init()
      } else if (currentMode.id === Modes.annotation.id) {
        this.annotatorManager = new AnnotatorManager()
        this.annotatorManager.init()
      }
    })
  }
}

window.addEventListener('load', (event) => {
  window.contentScript = new ContentScript()
  window.contentScript.init()
})
