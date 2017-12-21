const TextUtils = require('./utils/URLUtils')

class ACMContentScript {
  init () {
    // Get if this tab has an annotation to open and a doi
    let params = TextUtils.extractHashParamsFromUrl(window.location.href)
    if (params.hag) {
      // Activate the extension
      chrome.runtime.sendMessage({scope: 'extension', cmd: 'activatePopup'}, (result) => {
        console.log('Activated popup')
        // Retrieve pdf url
        let pdfUrlElement = document.querySelector('#divmain > table:nth-child(2) > tbody > tr > td:nth-child(1) > table:nth-child(1) > tbody > tr > td:nth-child(2) > a')
        let pdfUrl = pdfUrlElement.href
        // Append hash to pdf url
        pdfUrl += window.location.hash
        // Redirect browser to pdf
        window.location.replace(pdfUrl)
      })
    }
  }
}

window.hag = {}
window.hag.acmContentScript = new ACMContentScript()
window.hag.acmContentScript.init()
