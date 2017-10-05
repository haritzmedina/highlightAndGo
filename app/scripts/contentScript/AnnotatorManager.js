const Purpose = require('annotator/Purpose/Purpose')

class AnnotatorManager {
  constructor () {
    this.annotators = {
      'purpose': Purpose
    }
  }

  init () {
    // Retrieve current annotator
    chrome.runtime.sendMessage({scope: 'extension', cmd: 'getCurrentAnnotator'}, (currentAnnotator) => {
      let annotator = new this.annotators[currentAnnotator]()
      annotator.init()
    })
  }
}

module.exports = AnnotatorManager
