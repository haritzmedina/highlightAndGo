const _ = require('lodash')
const ChromeStorage = require('../utils/ChromeStorage')

const uriChromeStorageNamespace = 'ContentTypeManagerURI'

class ContentTypeManager {
  constructor () {
    this.originalDocumentURI = location.href.replace(location.hash, '')
    this.documentType = ContentTypeManager.documentTypes.html // By default document type is html
  }

  init (callback) {
    if (document.querySelector('embed[type="application/pdf"][name="plugin"]')) {
      this.saveCurrentURI(() => {
        window.location = chrome.extension.getURL('content/pdfjs/web/viewer.html') + '?file=' + window.location.href
      })
    } else {
      // If current web is pdf viewer.html, set document type as pdf
      if (window.location.pathname === '/content/pdfjs/web/viewer.html') {
        this.documentType = ContentTypeManager.documentTypes.pdf
        // Load current document URI
        this.getOriginalURI(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      } else {
        if (_.isFunction(callback)) {
          callback()
        }
      }
    }
  }

  saveCurrentURI (callback) {
    // Retrieve current tab id
    chrome.runtime.sendMessage({scope: 'extension', cmd: 'whoiam'}, (response) => {
      // Current tab id
      let tabId = response.tab.id
      ChromeStorage.getData(uriChromeStorageNamespace, ChromeStorage.local, (err, storedData) => {
        if (err) {
          throw new Error('Unable to retrieve saved uri')
        }
        let data = null
        if (!_.isEmpty(storedData) && storedData.data) {
          data = JSON.parse(storedData.data)
        } else {
          data = data || {}
          data.urls = data.urls || {}
        }
        data.urls[tabId] = this.originalDocumentURI
        ChromeStorage.setData(uriChromeStorageNamespace, {data: JSON.stringify(data)}, ChromeStorage.local, (err) => {
          if (err) {
            console.error(err)
          }
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    })
  }

  destroy (callback) {
    if (this.documentType === ContentTypeManager.documentTypes.pdf) {
      // Reload to original pdf website
      window.location.href = this.originalDocumentURI
    } else {
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }

  getOriginalURI (callback) {
    // Retrieve current tab id
    chrome.runtime.sendMessage({scope: 'extension', cmd: 'whoiam'}, (response) => {
      // Current tab id
      let tabId = response.tab.id
      ChromeStorage.getData(uriChromeStorageNamespace, ChromeStorage.local, (err, storedData) => {
        if (err) {
          throw new Error('Unable to retrieve original document uri')
        }
        if (_.isEmpty(storedData)) {
          throw new Error('Original URL shouldn\'t be empty')
        } else {
          let data = JSON.parse(storedData.data)
          this.originalDocumentURI = data.urls[tabId]
          if (_.isFunction(callback)) {
            callback()
          }
        }
      })
    })
  }
}

ContentTypeManager.documentTypes = {
  html: 'html',
  pdf: 'pdf'
}

module.exports = ContentTypeManager
