const _ = require('lodash')
const URLUtils = require('../utils/URLUtils')

class ContentTypeManager {
  constructor () {
    this.pdfFingerprint = null
    this.documentURL = null
    this.documentType = ContentTypeManager.documentTypes.html // By default document type is html
  }

  init (callback) {
    if (document.querySelector('embed[type="application/pdf"][name="plugin"]')) {
      window.location = chrome.extension.getURL('content/pdfjs/web/viewer.html') + '?file=' + encodeURIComponent(window.location.href)
    } else {
      // Load publication metadata
      this.tryToLoadDoi()
      this.tryToLoadPublicationPDF()
      // If current web is pdf viewer.html, set document type as pdf
      if (window.location.pathname === '/content/pdfjs/web/viewer.html') {
        this.waitUntilPDFViewerLoad(() => {
          this.pdfFingerprint = window.PDFViewerApplication.pdfDocument.pdfInfo.fingerprint
          this.documentURL = window.PDFViewerApplication.url
          this.documentType = ContentTypeManager.documentTypes.pdf
          if (_.isFunction(callback)) {
            callback()
          }
        })
      } else {
        this.documentType = ContentTypeManager.documentTypes.html
        this.documentURL = URLUtils.retrieveMainUrl(window.location.href)
        if (_.isFunction(callback)) {
          callback()
        }
      }
    }
  }

  destroy (callback) {
    if (this.documentType === ContentTypeManager.documentTypes.pdf) {
      // Reload to original pdf website
      window.location.href = this.documentURL
    } else {
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }

  waitUntilPDFViewerLoad (callback) {
    let interval = setInterval(() => {
      if (_.isObject(window.PDFViewerApplication.pdfDocument)) {
        clearInterval(interval)
        if (_.isFunction(callback)) {
          callback(window.PDFViewerApplication)
        }
      }
    }, 500)
  }

  tryToLoadDoi () {
    // Try to load doi from hash param
    let decodedUri = decodeURIComponent(window.location.href)
    let params = URLUtils.extractHashParamsFromUrl(decodedUri)
    if (!_.isEmpty(params) && !_.isEmpty(params.doi)) {
      this.doi = params.doi
    }
    // Try to load doi from page metadata
    if (_.isEmpty(this.doi)) {
      try {
        this.doi = document.querySelector('meta[name="citation_doi"]').content
      } catch (e) {
        console.log('Doi not found for this document')
      }
    }
    // TODO Try to load doi from chrome tab storage
  }

  tryToLoadPublicationPDF () {
    try {
      this.citationPdf = document.querySelector('meta[name="citation_pdf_url"]').content
    } catch (e) {
      console.log('citation pdf url not found')
    }
  }

  getDocumentRootElement () {
    if (this.documentType === ContentTypeManager.documentTypes.pdf) {
      return document.querySelector('#viewer')
    } else if (this.documentType === ContentTypeManager.documentTypes.html) {
      return document.body
    }
  }

  getDocumentURIToSearchInHypothesis () {
    if (this.documentType === ContentTypeManager.documentTypes.pdf) {
      return 'urn:x-pdf:' + this.pdfFingerprint
    } else {
      return this.documentURL
    }
  }

  getDocumentURIToSaveInHypothesis () {
    return this.documentURL
  }
}

ContentTypeManager.documentTypes = {
  html: {
    name: 'html',
    selectors: ['FragmentSelector', 'RangeSelector', 'TextPositionSelector', 'TextQuoteSelector']
  },
  pdf: {
    name: 'pdf',
    selectors: ['TextPositionSelector', 'TextQuoteSelector']
  }
}

module.exports = ContentTypeManager
