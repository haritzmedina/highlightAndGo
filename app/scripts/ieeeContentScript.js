const URLUtils = require('./utils/URLUtils')
const _ = require('lodash')
const DOI = require('doi-regex')

class IEEEContentScript {
  constructor () {
    this.doi = null
    this.hag = null
  }

  initDocument () {
    // Get url params
    let params = URLUtils.extractHashParamsFromUrl(window.location.href)
    // Get document doi
    if (!_.isEmpty(params) && !_.isEmpty(params.doi)) {
      this.doi = decodeURIComponent(params.doi)
    } else {
      // Scrap the doi from web
      this.doi = this.findDoi()
    }
    // Get pdf link element
    let pdfLinkElement = this.getPdfLinkElement()
    if (pdfLinkElement) {
      // Get if this tab has an annotation to open
      if (!_.isEmpty(params) && !_.isEmpty(params.hag)) {
        // Activate the extension
        chrome.runtime.sendMessage({scope: 'extension', cmd: 'activatePopup'}, (result) => {
          console.debug('Activated popup')
          // Retrieve pdf url
          let pdfUrl = pdfLinkElement.href
          // Create hash with required params to open extension
          let hash = '#hag:' + params.hag
          if (this.doi) {
            hash += '&doi:' + this.doi
          }
          // Append hash to pdf url
          pdfUrl += hash
          // Redirect browser to pdf
          window.location.replace(pdfUrl)
        })
      } else {
        // Append doi to PDF url
        if (pdfLinkElement) {
          pdfLinkElement.href += '#doi:' + this.doi
        }
      }
    }
  }

  /**
   * Depending on the article, the ACM-DL shows the DOI in different parts of the document. This function tries to find in the DOM the DOI for the current paper
   * @returns {*}
   */
  findDoi () {
    let doiElement = document.querySelector('[href*="doi.org"]')
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
    return document.querySelector('[href*="stamp/stamp.jsp"]')
  }

  initStamp () {
    // Get url params
    let params = URLUtils.extractHashParamsFromUrl(window.location.href)
    // Get document doi
    if (!_.isEmpty(params) && !_.isEmpty(params.doi)) {
      this.doi = decodeURIComponent(params.doi)
    } else {
      // Scrap the doi from web
      this.doi = this.findDoi()
    }
    // Get pdf link element
    let iframeElement = this.getIframeElement()
    if (iframeElement) {
      // Get if this tab has an annotation to open
      if (!_.isEmpty(params) && !_.isEmpty(params.hag)) {
        // Activate the extension
        chrome.runtime.sendMessage({scope: 'extension', cmd: 'activatePopup'}, (result) => {
          console.debug('Activated popup')
          // Retrieve pdf url
          let pdfUrl = iframeElement.src
          // Create hash with required params to open extension
          let hash = '#hag:' + params.hag
          if (this.doi) {
            hash += '&doi:' + this.doi
          }
          // Append hash to pdf url
          pdfUrl += hash
          // Redirect browser to pdf
          window.location.replace(pdfUrl)
        })
      } else {
        // Append doi to PDF url
        if (iframeElement) {
          iframeElement.src += '#doi:' + this.doi
          window.location.replace(iframeElement.src)
        }
      }
    }
  }

  getIframeElement () {
    return document.querySelector('iframe[src*="ieeexplore.ieee.org"')
  }
}

window.hag = {}
window.hag.ieeeContentScript = new IEEEContentScript()
if (window.location.href.includes('ieeexplore.ieee.org/document')) {
  window.hag.ieeeContentScript.initDocument()
} else if (window.location.href.includes('ieeexplore.ieee.org/stamp/stamp.jsp')) {
  window.hag.ieeeContentScript.initStamp()
}
