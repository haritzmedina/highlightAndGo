const TextUtils = require('./utils/URLUtils')
const HypothesisClientManager = require('./hypothesis/HypothesisClientManager')

class ScienceDirectContentScript {
  init () {
    // Get if this tab has an annotation to open and a doi
    let params = TextUtils.extractHashParamsFromUrl(window.location.href)
    if (!_.isEmpty(params) && !_.isEmpty(params.hag)) {
      // Activate the extension
      chrome.runtime.sendMessage({scope: 'extension', cmd: 'activatePopup'}, (result) => {
        // Retrieve if annotation is done in current url or in pdf version
        window.hag.hypothesisClientManager = new HypothesisClientManager()
        window.hag.hypothesisClientManager.init(() => {
          window.hag.hypothesisClientManager.hypothesisClient.fetchAnnotation(params.hag, (annotation) => {
            // TODO Check if annotation is from this page
            debugger
          })
        })
      })
    }
  }
}

window.hag = {}
window.hag.scienceDirectContentScript = new ScienceDirectContentScript()
window.hag.scienceDirectContentScript.init()
