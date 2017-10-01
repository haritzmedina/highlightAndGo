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
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.update(tabs[0].id, {url: tabs[0].url}, () => {
              console.log('Switched and reloaded ')
            })
          })
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
