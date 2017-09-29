const Modes = require('./Modes')

class ModesManager {
  constructor () {
    this.currentMode = Modes.view // TODO By default is original
  }

  init () {
    // Initialize replier for requests of modes related metadata
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'extension') {
        if (request.cmd === 'getCurrentMode') {
          console.log(this.currentMode)
          sendResponse(this.currentMode)
        } else if (request.cmd === 'setMode') {
          this.setMode(request.params.mode)
          sendResponse(true)
        }
      }
    })
  }

  setMode (mode) {
    this.currentMode = mode
  }

  getMode () {
    return this.currentMode
  }
}

module.exports = ModesManager
