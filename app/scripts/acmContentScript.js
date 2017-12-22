const TextUtils = require('./utils/URLUtils')
const _ = require('lodash')
const DOI = require('doi-regex')

class ACMContentScript {
  init () {
    // Get if this tab has an annotation to open and a doi
    let params = TextUtils.extractHashParamsFromUrl(window.location.href)
    if (!_.isEmpty(params) && !_.isEmpty(params.hag)) {
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
    } else {
      // Scrap DOI from web and add pdf to url
      let doi = this.findDoi()
      let pdfElement = this.getPdfLinkElement()
      if (pdfElement) {
        pdfElement.href += '#doi:' + doi
      } else {
        console.log('PDF URL not found')
      }
    }
  }

  findDoi () {
    let doiElement = document.querySelector('#divmain > table:nth-child(4) > tbody > tr > td > table > tbody > tr:nth-child(4) > td > span:nth-child(10) > a')
    if (this.checkIfDoiElement(doiElement)) {
      return doiElement.innerText
    }
    doiElement = document.querySelector('#divmain > table > tbody > tr > td:nth-child(1) > table:nth-child(3) > tbody > tr > td > table > tbody > tr:nth-child(5) > td > span:nth-child(10) > a')
    if (this.checkIfDoiElement(doiElement)) {
      return doiElement.innerText
    }
    return null
  }

  checkIfDoiElement (doiElement) {
    return _.isElement(doiElement) &&
      _.isString(doiElement.innerText) &&
      _.isArray(DOI.groups(doiElement.innerText)) &&
      _.isString(DOI.groups(doiElement.innerText)[1])
  }

  getPdfLinkElement () {
    return document.querySelector('#divmain > table:nth-child(2) > tbody > tr > td:nth-child(1) > table:nth-child(1) > tbody > tr > td:nth-child(2) > a')
  }
}

window.hag = {}
window.hag.acmContentScript = new ACMContentScript()
window.hag.acmContentScript.init()
