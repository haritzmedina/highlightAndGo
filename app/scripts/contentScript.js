const ContentScriptManager = require('./contentScript/ContentScriptManager')

const _ = require('lodash')
if (_.isEmpty(window.abwa)) {
  window.abwa = {} // Global namespace for variables

  window.addEventListener('load', () => {
    chrome.extension.onMessage.addListener((msg, sender, sendResponse) => {
      if (_.isEmpty(window.abwa.contentScriptManager)) {
        window.abwa.contentScriptManager = new ContentScriptManager()
        if (msg.action === 'initContentScript') {
          window.abwa.contentScriptManager.init()
        } else if (msg.action === 'destroyContentScript') {
          window.abwa.contentScriptManager.destroy()
        }
      }
    })
  })
}
