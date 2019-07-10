const TextUtils = require('./utils/URLUtils')
const HypothesisClientManager = require('./storage/hypothesis/HypothesisClientManager')
const LocalStorageManager = require('./storage/local/LocalStorageManager')
const _ = require('lodash')

class ScienceDirectContentScript {
  init () {
    // Get if this tab has an annotation to open and a doi
    let params = TextUtils.extractHashParamsFromUrl(window.location.href)
    if (!_.isEmpty(params) && !_.isEmpty(params.hag)) {
      // Activate the extension
      chrome.runtime.sendMessage({scope: 'extension', cmd: 'activatePopup'}, (result) => {
        this.loadStorage((err) => {
          if (err) {

          } else {
            window.hag.storageManager.client.fetchAnnotation(params.hag, (err, annotation) => {
              if (err) {
                console.error(err)
              } else {
                // TODO Check if annotation is from this page
              }
            })
          }
        })
      })
    }
  }

  loadStorage (callback) {
    chrome.runtime.sendMessage({scope: 'storage', cmd: 'getSelectedStorage'}, ({storage}) => {
      if (storage === 'hypothesis') {
        // Hypothesis
        window.hag.storageManager = new HypothesisClientManager()
      } else {
        // Local storage
        window.hag.storageManager = new LocalStorageManager()
      }
      window.hag.storageManager.init((err) => {
        if (_.isFunction(callback)) {
          if (err) {
            callback(err)
          } else {
            callback()
          }
        }
      })
    })
  }
}

window.hag = {}
window.hag.scienceDirectContentScript = new ScienceDirectContentScript()
window.hag.scienceDirectContentScript.init()
