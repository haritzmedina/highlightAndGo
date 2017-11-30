class ContentTypeManager {
  constructor () {
    this.currentDocumentUri = window.location.href // TODO Remove hash and those things
  }

  init (callback) {
    if (document.querySelector('embed[type="application/pdf"][name="plugin"]')) {
      console.log('Is pdf')
      window.location = chrome.extension.getURL('content/pdfjs/web/viewer.html') + '?file=' + window.location.href
    } else {
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }
}

module.exports = ContentTypeManager
