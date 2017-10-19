const Annotators = require('../background/Annotators')
const Purpose = require('./annotator/Purpose/Purpose')

class AnnotatorManager {
  constructor () {
    this.purposeAnnotator = null
  }

  init () {
    // Retrieve current annotator
    chrome.runtime.sendMessage({scope: 'extension', cmd: 'getCurrentAnnotator'}, (currentAnnotator) => {
      if (currentAnnotator.id === Annotators.purpose.id) {
        this.purposeAnnotator = new Purpose()
        this.purposeAnnotator.init()
      }
    })
  }
}

module.exports = AnnotatorManager
