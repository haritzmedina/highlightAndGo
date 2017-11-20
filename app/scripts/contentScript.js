const ContentScriptManager = require('./contentScript/ContentScriptManager')

window.abwa = {} // Global namespace for variables

window.addEventListener('load', () => {
  chrome.extension.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'initContentScript') {
      let contentScriptManager = new ContentScriptManager()
      contentScriptManager.init()
    }
  })
})
