const ContentScriptManager = require('./contentScript/ContentScriptManager')

const _ = require('lodash')
if (_.isEmpty(window.abwa)) {
  window.abwa = {} // Global namespace for variables

  window.addEventListener('load', () => {
    if (_.isEmpty(window.abwa.contentScriptManager)) {
      chrome.extension.onMessage.addListener((msg, sender, sendResponse) => {
        window.abwa.contentScriptManager = new ContentScriptManager()
        if (msg.action === 'initContentScript') {
          console.debug('Initializing annotator')
          window.abwa.contentScriptManager.init()
        } else if (msg.action === 'destroyContentScript') {
          console.debug('Destroying annotator')
          window.abwa.contentScriptManager.destroy()
        }
      })
    }
  })
}
