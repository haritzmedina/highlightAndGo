const Annotators = require('./Annotators')
const LanguageUtils = require('../utils/LanguageUtils')

const defaultAnnotator = Annotators.purpose

class SelectedAnnotatorManager {
  constructor () {
    this.currentAnnotators = {}
  }

  init () {
    // Initialize replier for requests of modes related metadata
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'extension') {
        if (request.cmd === 'getCurrentAnnotator') {
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            console.debug(this.getAnnotator(tabs[0].id))
            sendResponse(this.getAnnotator(tabs[0].id))
          })
          return true
        } else if (request.cmd === 'setAnnotator') {
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            this.setAnnotator(request.params.annotator, tabs[0].id)
            chrome.tabs.update(tabs[0].id, {url: tabs[0].url}, () => {
              sendResponse(true)
              console.debug('Switched and reloaded ')
            })
          })
          return true
        }
      }
    })
  }

  setAnnotator (annotator, tabId) {
    this.currentAnnotators[tabId] = annotator
  }

  getAnnotator (tabId) {
    if (LanguageUtils.isEmptyObject(this.currentAnnotators[tabId])) {
      this.setAnnotator(defaultAnnotator, tabId)
    }
    return this.currentAnnotators[tabId]
  }
}

module.exports = SelectedAnnotatorManager
