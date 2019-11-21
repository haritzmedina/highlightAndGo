const _ = require('lodash')
const Events = require('./Events')
const URLUtils = require('../utils/URLUtils')
const LanguageUtils = require('../utils/LanguageUtils')
const CryptoUtils = require('../utils/CryptoUtils')
const RandomUtils = require('../utils/RandomUtils')
const axios = require('axios')
const DOI = require('doi-regex')

const URL_CHANGE_INTERVAL_IN_SECONDS = 1

class ContentTypeManager {
  constructor () {
    this.url = null
    this.urlChangeInterval = null
    this.urlParam = null
    this.documentId = null
    this.localFile = false
    this.documentFormat = ContentTypeManager.documentFormat.html // By default document type is html
  }

  init (callback) {
    if (document.querySelector('embed[type="application/pdf"]')) {
      window.location = chrome.extension.getURL('content/pdfjs/web/viewer.html') + '?file=' + encodeURIComponent(window.location.href)
    } else {
      this.reloadTargetInformation(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
    }
  }

  /**
   * Retrieves information about the target that is annotating (current website)
   * @param callback
   */
  reloadTargetInformation (callback) {
    // Load publication metadata
    this.tryToLoadDoi()
    this.tryToLoadPublicationPDF()
    this.tryToLoadURLParam()
    this.loadDocumentFormat().then(() => {
      this.tryToLoadTitle()
      this.tryToLoadURL()
      this.tryToLoadURN()
      this.tryToLoadTargetId()
      if (this.url.startsWith('file:///')) {
        this.localFile = true
      } else if (this.documentFormat !== ContentTypeManager.documentFormat.pdf) { // If document is not pdf, it can change its URL
        // Support in ajax websites web url change, web url can change dynamically, but local files never do
        this.initSupportWebURLChange()
      }
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  destroy (callback) {
    if (this.documentFormat === ContentTypeManager.documentFormat.pdf) {
      // Reload to original pdf website
      window.location.href = this.url || window.PDFViewerApplication.baseUrl
    } else {
      if (_.isFunction(callback)) {
        callback()
      }
    }
    clearInterval(this.urlChangeInterval)
  }

  /**
   * Resolves which format
   * @returns {Promise<unknown>}
   */
  loadDocumentFormat () {
    return new Promise((resolve) => {
      if (window.location.pathname === '/content/pdfjs/web/viewer.html') {
        this.documentFormat = ContentTypeManager.documentFormat.pdf
        this.waitUntilPDFViewerLoad(() => {
          resolve()
        })
        return true
      } else {
        this.documentFormat = ContentTypeManager.documentFormat.html
        resolve()
      }
    })
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
    if (!_.isEmpty(params) && !_.isEmpty(params.doi) && params.doi !== 'null') {
      let doiParamDecoded = decodeURIComponent(params.doi)
      if (this.isDOI(doiParamDecoded)) {
        this.doi = doiParamDecoded
      }
    }
    // Try to load doi from page metadata
    if (_.isEmpty(this.doi)) {
      try {
        let citationDoi = document.querySelector('meta[name="citation_doi"]').content
        if (this.isDOI(citationDoi)) {
          this.doi = citationDoi
        }
        if (!this.doi) {
          let dcIdentifier = document.querySelector('meta[name="dc.identifier"]').content
          if (this.isDOI(dcIdentifier)) {
            this.doi = dcIdentifier
          }
        }
      } catch (e) {
        console.debug('Doi not found for this document')
      }
    }
    // TODO Try to load doi from chrome tab storage
  }

  isDOI (doiString) {
    return DOI({exact: true}).test(doiString)
  }

  tryToLoadURLParam () {
    let decodedUri = decodeURIComponent(window.location.href)
    console.log(decodedUri)
    let params = URLUtils.extractHashParamsFromUrl(decodedUri, '::')
    console.log(params)
    if (!_.isEmpty(params) && !_.isEmpty(params.url)) {
      console.debug(params.url)
      this.urlParam = params.url
    }
  }

  tryToLoadPublicationPDF () {
    try {
      this.citationPdf = document.querySelector('meta[name="citation_pdf_url"]').content
    } catch (e) {
      console.log('citation pdf url not found')
    }
  }

  getDocumentRootElement () {
    if (this.documentFormat === ContentTypeManager.documentFormat.pdf) {
      return document.querySelector('#viewer')
    } else if (this.documentFormat === ContentTypeManager.documentFormat.html) {
      return document.body
    }
  }

  getDocumentURIToSearchInStorage () {
    if (this.documentFormat === ContentTypeManager.documentFormat.pdf) {
      return this.urn
    } else {
      return this.url
    }
  }

  getDocumentURIToSaveInStorage () {
    if (this.doi) {
      return 'https://doi.org/' + this.doi
    } else if (this.url) {
      return this.url
    } else if (this.urn) {
      return this.urn
    } else {
      throw new Error('Unable to retrieve any IRI for this document.')
    }
  }

  /**
   * Adds an observer which checks if the URL changes
   */
  initSupportWebURLChange () {
    if (_.isEmpty(this.urlChangeInterval)) {
      this.urlChangeInterval = setInterval(() => {
        let newUrl = this.getDocumentURL()
        if (newUrl !== this.url) {
          console.debug('Document URL updated from %s to %s', this.url, newUrl)
          this.url = newUrl
          // Reload target information
          this.reloadTargetInformation(() => {
            // Dispatch event
            LanguageUtils.dispatchCustomEvent(Events.updatedDocumentURL, {url: this.url})
          })
        }
      }, URL_CHANGE_INTERVAL_IN_SECONDS * 1000)
    }
  }

  tryToLoadPlainTextFingerprint () {
    let fileTextContentElement = document.querySelector('body > pre')
    if (fileTextContentElement) {
      let fileTextContent = fileTextContentElement.innerText
      return CryptoUtils.hash(fileTextContent.innerText)
    }
  }

  tryToLoadTitle () {
    // Try to load by doi
    let promise = new Promise((resolve, reject) => {
      if (this.doi) {
        let settings = {
          'async': true,
          'crossDomain': true,
          'url': 'https://doi.org/' + this.doi,
          'method': 'GET',
          'headers': {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }
        // Call using axios
        axios(settings).then((response) => {
          if (response.data && response.data.title) {
            this.documentTitle = response.data.title
          }
          resolve()
        })
      } else {
        resolve()
      }
    })
    promise.then(() => {
      // Try to load title from page metadata
      if (_.isEmpty(this.documentTitle)) {
        try {
          let documentTitleElement = document.querySelector('meta[name="citation_title"]')
          if (!_.isNull(documentTitleElement)) {
            this.documentTitle = documentTitleElement.content
          }
          if (!this.documentTitle) {
            let documentTitleElement = document.querySelector('meta[property="og:title"]')
            if (!_.isNull(documentTitleElement)) {
              this.documentTitle = documentTitleElement.content
            }
            if (!this.documentTitle) {
              let promise = new Promise((resolve) => {
                // Try to load title from pdf metadata
                if (this.documentFormat === ContentTypeManager.documentFormat.pdf) {
                  this.waitUntilPDFViewerLoad(() => {
                    if (window.PDFViewerApplication.documentInfo.Title) {
                      this.documentTitle = window.PDFViewerApplication.documentInfo.Title
                    }
                    resolve()
                  })
                } else {
                  resolve()
                }
              })
              promise.then(() => {
                // Try to load title from document title
                if (!this.documentTitle) {
                  this.documentTitle = document.title || 'Unknown document'
                }
              })
            }
          }
        } catch (e) {
          console.debug('Title not found for this document')
        }
      }
    })
  }

  getDocumentURIs () {
    let uris = {}
    if (this.doi) {
      uris['doi'] = 'https://doi.org/' + this.doi
    }
    if (this.url) {
      uris['url'] = this.url
    }
    if (this.urn) {
      uris['urn'] = this.urn
    }
    if (this.citationPdf) {
      uris['citationPdf'] = this.citationPdf
    }
    return uris
  }

  tryToLoadURN () {
    // If document is PDF
    if (this.documentFormat === ContentTypeManager.documentFormat.pdf) {
      this.fingerprint = window.PDFViewerApplication.pdfDocument.pdfInfo.fingerprint
      this.urn = 'urn:x-pdf:' + this.fingerprint
    } else {
      // If document is plain text
      this.fingerprint = this.tryToLoadPlainTextFingerprint()
      if (this.fingerprint) {
        this.urn = 'urn:x-txt:' + this.fingerprint
      }
    }
  }

  tryToLoadURL () {
    if (this.urlParam) {
      this.url = this.urlParam
    } else {
      this.url = this.getDocumentURL()
    }
  }

  getDocumentURL () {
    if (this.documentFormat === ContentTypeManager.documentFormat.pdf) {
      return window.PDFViewerApplication.url
    } else {
      return URLUtils.retrieveMainUrl(window.location.href) // TODO Check this, i think this url is not valid
    }
  }

  tryToLoadTargetId () {
    // Wait until updated all annotations is loaded
    this.targetIdEventListener = document.addEventListener(Events.updatedAllAnnotations, () => {
      if (window.abwa.contentAnnotator.allAnnotations.length > 0) {
        this.documentId = window.abwa.contentAnnotator.allAnnotations[0].target[0].source.id
      } else {
        this.documentId = RandomUtils.randomString()
      }
    })
  }

  getDocumentId () {
    return this.documentId || RandomUtils.randomString()
  }
}

ContentTypeManager.documentFormat = {
  html: {
    name: 'html',
    selectors: ['FragmentSelector', 'RangeSelector', 'TextPositionSelector', 'TextQuoteSelector']
  },
  pdf: {
    name: 'pdf',
    selectors: ['FragmentSelector', 'TextPositionSelector', 'TextQuoteSelector']
  }
}

module.exports = ContentTypeManager
