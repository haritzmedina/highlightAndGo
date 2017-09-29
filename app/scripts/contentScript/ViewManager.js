const HypothesisClient = require('../hypothesis/HypothesisClient')
const Popup = require('./operations/Popup/Popup')
class ViewManager {
  constructor () {
    this.hypothesisClient = null
  }

  init () {
    // TODO Load hypothesis annotations for current page
    this.loadHypothesisAnnotations((annotations) => {
      console.log(annotations)
      // TODO Apply operations for annotations
      annotations.forEach(annotation => {
        this.applyOperation(annotation)
      })
    })
  }

  loadHypothesisAnnotations (callback) {
    // Retrieve current token if available
    chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getToken'}, (token) => {
      this.hypothesisClient = new HypothesisClient(token)
      this.hypothesisClient.searchAnnotations({uri: window.location.href}, callback)
    })
  }

  applyOperation (annotation) {
    // TODO Retrieve from annotation the operation to be done (in tags)
    console.log(annotation.tags)
    if (annotation.tags.includes('Popup')) {
      let popup = new Popup(annotation)
      popup.load()
    }
    // TODO Retrieve the functionality required to apply the operation
    // TODO Apply the operation for the targeted content
  }
}

module.exports = ViewManager
