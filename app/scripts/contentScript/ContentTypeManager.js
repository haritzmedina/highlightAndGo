const _ = require('lodash')
const ChromeStorage = require('../utils/ChromeStorage')

class ContentTypeManager {
  constructor () {
    this.currentDocumentUri = window.location.href
  }

  init (callback) {
    if (document.querySelector('embed[type="application/pdf"][name="plugin"]')) {
      console.log('Is pdf')
      this.saveCurrentURI(() => {
        window.location = chrome.extension.getURL('content/pdfjs/web/viewer.html') + '?file=' + window.location.href
      })
    } else {
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }

  saveCurrentURI (callback) {
    // Retrieve current tab id
    chrome.runtime.sendMessage({scope: 'extension', cmd: 'whoiam'}, (response) => {
      // Current tab id
      let tabId = response.tab.id
      ChromeStorage.getData('ContentTypeManagerURI', ChromeStorage.local, (data) => {
        if (data && data.urls) {
          data.urls[tabId] = this.currentDocumentUri
        } else {
          data = data || {}
          data.urls = data.urls || {}
        }
        ChromeStorage.setData('ContentTypeManager', data, ChromeStorage.local, () => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    })
  }
}

module.exports = ContentTypeManager
