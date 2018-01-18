const ContentScriptManager = require('./contentScript/ContentScriptManager')
const AnnotationBasedInitializer = require('./contentScript/AnnotationBasedInitializer')

const _ = require('lodash')
window.addEventListener('load', () => {
  console.debug('Loaded abwa content script')
  if (_.isEmpty(window.abwa)) {
    window.abwa = {} // Global namespace for variables
    chrome.extension.onMessage.addListener((msg) => {
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
    // Check if uri contains annotation to initialize
    let annotation = AnnotationBasedInitializer.getAnnotationHashParam()
    if (annotation) {
      // If extension is not activated, activate
      chrome.runtime.sendMessage({scope: 'extension', cmd: 'activatePopup'}, () => {
        console.debug('Activated popup by annotation')
      })
    }
  }
})
