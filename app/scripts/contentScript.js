const GlobalManager = require('./contentScript/GlobalManager')

class GlobalContentScript {
  init () {
    chrome.extension.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'openGlobalManager') {
        let globalManager = new GlobalManager()
        globalManager.init()
      }
    })
  }
}

window.addEventListener('load', () => {
  window.contentScript = new GlobalContentScript()
  window.contentScript.init()
})
