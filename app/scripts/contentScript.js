const ContentScriptManager = require('./contentScript/ContentScriptManager')
const AnnotationBasedInitializer = require('./contentScript/AnnotationBasedInitializer')

const _ = require('lodash')

console.debug('Loaded abwa content script')
if (_.isEmpty(window.abwa)) {
  window.abwa = {} // Global namespace for variables
  // Add listener for popup button click
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
        window.abwa.contentScriptManager.destroy(() => {
          window.abwa = {} // Clean window.abwa variable
        })
      }
    }
  })
  // Check if uri contains annotation to initialize
  let promise = new Promise((resolve) => {
    if (window.location.href.includes('dl.dropboxusercontent.com') && !window.location.href.includes('chrome-extension')) {
      chrome.runtime.onMessage.addListener((request, sender, sendresponse) => {
        if (request.scope === 'dropbox' && request.cmd === 'redirection') {
          let url = new URL(window.location.href)
          if (!url.hash.includes('url:') && request.data.url) {
            let location = window.location.href + 'url::' + request.data.url
            if (request.data.annotationId) {
              location += '&hag:' + request.data.annotationId
            }
            window.location.href = location
          }
        }
        resolve()
      })
    } else if (window.location.href.includes('chrome-extension://')) {
      chrome.runtime.onMessage.addListener((request, sender, sendresponse) => {
        if (request.scope === 'dropbox' && request.cmd === 'redirection') {
          let currentUrlParam = window.location.href
          let currentUrl = new URL(currentUrlParam)
          let dynamicUrlParam = currentUrl.searchParams.get('file')
          let dynamicUrl = new URL(dynamicUrlParam)
          if (!dynamicUrl.hash.includes('url:') && request.data.url) {
            let definitiveUrl = 'url::' + request.data.url
            if (request.data.annotationId) {
              definitiveUrl += '&hag:' + request.data.annotationId
            }
            window.location.replace(currentUrlParam + encodeURIComponent(definitiveUrl))
          }
        }
        resolve()
      })
    } else {
      resolve()
    }
  })
  promise.then(() => {
    let annotation = AnnotationBasedInitializer.getAnnotationHashParam()
    if (annotation) {
      // If extension is not activated, activate
      chrome.runtime.sendMessage({scope: 'extension', cmd: 'activatePopup'}, () => {
        console.debug('Activated popup by annotation')
      })
    } else {
      // Check if button is activated for this tab
      chrome.runtime.sendMessage({scope: 'extension', cmd: 'amIActivated'}, (response) => {
        if (response.activated) {
          if (_.isEmpty(window.abwa.contentScriptManager)) {
            window.abwa.contentScriptManager = new ContentScriptManager()
            if (window.abwa.contentScriptManager.status === ContentScriptManager.status.notInitialized) {
              window.abwa.contentScriptManager.init()
            }
          }
        }
      })
    }
  })
}
