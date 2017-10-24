const Modes = require('./Modes')
const LanguageUtils = require('../utils/LanguageUtils')

const defaultMode = Modes.annotation // TODO By default it is original
// const defaultMode = Modes.original // By default it is original

class ModesManager {
  constructor () {
    this.currentModes = {}
  }

  init () {
    // Initialize replier for requests of modes related metadata
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'extension') {
        if (request.cmd === 'getCurrentMode') {
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            console.debug(this.getMode(tabs[0].id))
            sendResponse(this.getMode(tabs[0].id))
          })
          return true
        } else if (request.cmd === 'setMode') {
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            this.setMode(request.params.mode, tabs[0].id)
            chrome.tabs.update(tabs[0].id, {url: tabs[0].url}, () => {
              sendResponse(true)
              console.debug('Switched and reloaded ')
            })
          })
          return true
        }
      }
    })
  }

  setMode (mode, tabId) {
    this.currentModes[tabId] = mode
  }

  getMode (tabId) {
    if (LanguageUtils.isEmptyObject(this.currentModes[tabId])) {
      this.setMode(defaultMode, tabId)
    }
    return this.currentModes[tabId]
  }
}

module.exports = ModesManager
