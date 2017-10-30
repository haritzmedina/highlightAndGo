const Annotators = require('../background/Annotators')
const Purpose = require('./annotator/Purpose/Purpose')
const LanguageUtils = require('../utils/LanguageUtils')

class AnnotatorManager {
  constructor () {
    this.purposeAnnotator = null
  }

  init (callback) {
    // Retrieve current annotator
    chrome.runtime.sendMessage({scope: 'extension', cmd: 'getCurrentAnnotator'}, (currentAnnotator) => {
      if (currentAnnotator.id === Annotators.purpose.id) {
        this.purposeAnnotator = new Purpose()
        this.purposeAnnotator.init(callback)
      }
    })
  }

  initializeByAnnotations (annotations, callback) {
    // TODO Detect which annotator correspond to the annotation
    this.purposeAnnotator = new Purpose()
    if (LanguageUtils.isFunction(callback)) {
      this.purposeAnnotator.initializeByAnnotations(annotations)
    }
  }
}

module.exports = AnnotatorManager
