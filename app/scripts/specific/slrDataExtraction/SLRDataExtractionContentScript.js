const $ = require('jquery')

class SLRDataExtractionContentScript {
  constructor () {
    this.linkToSLR = null
  }

  init (callback) {
    this.linkToSLR = document.createElement('a')
    this.linkToSLR.href = chrome.extension.getURL('content/slrView/index.html')
    this.linkToSLR.innerText = 'View current status'
    this.linkToSLR.target = '_blank'
    $('#groupBody').append(this.linkToSLR)
  }

  destroy () {
    if (this.linkToSLR) {
      $(this.linkToSLR).remove()
    }
  }
}

module.exports = SLRDataExtractionContentScript
