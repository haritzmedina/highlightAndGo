const ContentScriptManager = require('./contentScript/ContentScriptManager')

const _ = require('lodash')

if (_.isEmpty(window.abwa)) {
  window.abwa = {} // Global namespace for variables

  window.addEventListener('load', () => {
    chrome.extension.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'initContentScript') {
        let contentScriptManager = new ContentScriptManager()
        contentScriptManager.init()
      }
    })
  })
}
