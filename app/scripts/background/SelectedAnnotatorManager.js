const Annotators = require('./Annotators')

class SelectedAnnotatorManager {
  constructor () {
    this.currentAnnotator = Annotators.purpose
  }

  init () {
    // Initialize replier for requests of modes related metadata
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('hey')
      if (request.scope === 'extension') {
        if (request.cmd === 'getCurrentAnnotator') {
          console.debug(this.currentAnnotator)
          sendResponse(this.currentAnnotator)
        } else if (request.cmd === 'setAnnotator') {
          this.setMode(request.params.annotator)
          sendResponse(true)
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.update(tabs[0].id, {url: tabs[0].url}, () => {
              console.log('Switched and reloaded ')
            })
          })
        }
      }
    })
  }

  setMode (annotator) {
    this.currentAnnotator = annotator
  }

  getMode () {
    return this.currentAnnotator
  }
}

module.exports = SelectedAnnotatorManager
