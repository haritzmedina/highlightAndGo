const ContentScriptManager = require('./contentScript/ContentScriptManager')

const _ = require('lodash')
window.addEventListener('load', () => {
  if (_.isEmpty(window.abwa)) {
    window.abwa = {} // Global namespace for variables
    chrome.extension.onMessage.addListener((msg, sender, sendResponse) => {
      if (_.isEmpty(window.abwa.contentScriptManager)) {
        window.abwa.contentScriptManager = new ContentScriptManager()
      }
      if (msg.action === 'initContentScript') {
        if (window.abwa.contentScriptManager.status === ContentScriptManager.status.notInitialized) {
          window.abwa.contentScriptManager.init()
        }
      } else if (msg.action === 'destroyContentScript') {
        if (window.abwa.contentScriptManager.status === ContentScriptManager.status.initialized) {
          window.abwa.contentScriptManager.destroy()
        }
      }
    })
  }
})
