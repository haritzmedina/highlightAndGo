const Purpose = require('./annotator/Purpose/Purpose')
const Linkage = require('./operations/Linkage/Linkage')
const Popup = require('./operations/Popup/Popup')
const HypothesisClient = require('../hypothesis/HypothesisClient')

class GlobalManager {
  init (callback) {
    this.purposeAnnotator = new Purpose()
    this.linkage = new Linkage()
    this.popup = new Popup()
    this.purposeAnnotator.init((currentGroup) => {
      this.currentGroup = currentGroup
      this.retrieveAnnotations(callback)
    })
  }

  retrieveAnnotations (callback) {
    // Load hypothesis annotations for current page
    this.loadHypothesisAnnotations((annotations) => {
      console.debug(annotations)
      // Apply operations for annotations
      annotations.forEach(annotation => {
        this.applyOperation(annotation)
      })
    })
  }

  loadHypothesisAnnotations (callback) {
    // Retrieve current token if available
    chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getToken'}, (token) => {
      this.hypothesisClient = new HypothesisClient(token)
      this.hypothesisClient.searchAnnotations({uri: window.location.href, group: this.currentGroup.id}, callback)
    })
  }

  applyOperation (annotation) {
    // TODO Retrieve from annotation the operation to be done (in tags)
    // TODO Retrieve the functionality required to apply the operation
    // TODO Apply the operation for the targeted content
    if (this.includesTag(annotation.tags, 'popup')) {
      let popup = new Popup(annotation)
      popup.load()
    } else if (this.includesTag(annotation.tags, 'linkage')) {
      let linkage = new Linkage(annotation)
      linkage.load()
    }
  }

  includesTag (array, tag) {
    for (let i = 0; i < array.length; i++) {
      if (array[i].toLowerCase() === tag) {
        return true
      }
    }
    return false
  }
}

module.exports = GlobalManager
