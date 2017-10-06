const Annotators = require('../background/Annotators')
const Purpose = require('./annotator/Purpose/Purpose')

class AnnotatorManager {
  init () {
    // Retrieve current annotator
    chrome.runtime.sendMessage({scope: 'extension', cmd: 'getCurrentAnnotator'}, (currentAnnotator) => {
      if (currentAnnotator.id === Annotators.purpose.id) {
        let purposeAnnotator = new Purpose()
        purposeAnnotator.init()
      }
    })
  }
}

module.exports = AnnotatorManager
