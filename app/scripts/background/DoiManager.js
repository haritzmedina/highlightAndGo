const DOI = require('doi-regex')
const _ = require('lodash')

class DoiManager {
  constructor () {
    this.doiUrlFilterObject = { 'urls': ['*://*.doi.org/*', '*://doi.org/*'] }
    this.scienceDirect = { 'urls': ['*://www.sciencedirect.com/science/article/pii/*'] }
    this.dropbox = {'urls': ['*://www.dropbox.com/s/*?raw=1*']}
    this.dropboxContent = {'urls': ['*://*.dropboxusercontent.com/*']}
    this.ieee = {'urls': ['*://ieeexplore.ieee.org/document/*']}
    this.tabs = {}
  }

  init () {
    // Requests to doi.org
    chrome.webRequest.onHeadersReceived.addListener((responseDetails) => {
      console.debug(responseDetails)
      // Retrieve doi from call
      let doi = DOI.groups(responseDetails.url)[1]
      let annotationId = this.extractAnnotationId(responseDetails.url)
      let redirectUrl = responseDetails.responseHeaders[2].value
      redirectUrl += '#doi:' + doi
      if (annotationId) {
        redirectUrl += '&hag:' + annotationId
      }
      responseDetails.responseHeaders[2].value = redirectUrl
      this.tabs[responseDetails.tabId] = {doi: doi, annotationId: annotationId}
      return {responseHeaders: responseDetails.responseHeaders}
    }, this.doiUrlFilterObject, ['responseHeaders', 'blocking'])

    // Requests to sciencedirect, redirection from linkinghub.elsevier.com (parse doi and hag if present)
    chrome.webRequest.onBeforeSendHeaders.addListener((requestHeaders) => {
      if (this.tabs[requestHeaders.tabId]) {
        let data = this.tabs[requestHeaders.tabId]
        chrome.tabs.get(requestHeaders.tabId, (tab) => {
          let doi = data.doi
          let annotationId = data.annotationId
          if (doi && annotationId) {
            let redirectUrl = requestHeaders.url + '#doi:' + doi + '&hag:' + annotationId
            chrome.tabs.update(requestHeaders.tabId, {url: redirectUrl})
          } else if (doi) {
            let redirectUrl = requestHeaders.url + '#doi:' + doi
            chrome.tabs.update(requestHeaders.tabId, {url: redirectUrl})
          } else if (annotationId) {
            let redirectUrl = requestHeaders.url + '#hag:' + annotationId
            chrome.tabs.update(requestHeaders.tabId, {url: redirectUrl})
          }
        })
        delete this.tabs[requestHeaders.tabId] // Delete metadata saved in tabs for current tab
      }
    }, this.scienceDirect, ['requestHeaders', 'blocking'])
    // Request to IEEE
    chrome.webRequest.onBeforeSendHeaders.addListener((requestHeaders) => {
      if (this.tabs[requestHeaders.tabId]) {
        let data = this.tabs[requestHeaders.tabId]
        chrome.tabs.get(requestHeaders.tabId, (tab) => {
          let doi = data.doi
          let annotationId = data.annotationId
          if (doi && annotationId) {
            let redirectUrl = requestHeaders.url + '#doi:' + doi + '&hag:' + annotationId
            chrome.tabs.update(requestHeaders.tabId, {url: redirectUrl})
          } else if (doi) {
            let redirectUrl = requestHeaders.url + '#doi:' + doi
            chrome.tabs.update(requestHeaders.tabId, {url: redirectUrl})
          } else if (annotationId) {
            let redirectUrl = requestHeaders.url + '#hag:' + annotationId
            chrome.tabs.update(requestHeaders.tabId, {url: redirectUrl})
          }
        })
        delete this.tabs[requestHeaders.tabId] // Delete metadata saved in tabs for current tab
      }
    }, this.ieee, ['requestHeaders', 'blocking'])
    // Request to dropbox
    chrome.webRequest.onHeadersReceived.addListener((responseDetails) => {
      this.tabs[responseDetails.tabId] = {
        url: responseDetails.url.split('#')[0],
        annotationId: this.extractAnnotationId(responseDetails.url)
      }
      /* let redirectUrl = _.find(responseDetails.responseHeaders, (header) => { return header.name.toLowerCase() === 'location' }).value
      let index = _.findIndex(responseDetails.responseHeaders, (header) => { return header.name.toLowerCase() === 'location' })
      redirectUrl += '#url::' + responseDetails.url.split('#')[0] // Get only the url of the document
      let annotationId = this.extractAnnotationId(responseDetails.url)
      if (annotationId) {
        redirectUrl += '&hag:' + annotationId
      }
      responseDetails.responseHeaders[index].value = redirectUrl
      return {responseHeaders: responseDetails.responseHeaders} */
    }, this.dropbox, ['responseHeaders', 'blocking'])
    // Request dropbox pdf files
    chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
      let index = _.findIndex(details.requestHeaders, (header) => { return header.name.toLowerCase() === 'accept' })
      details.requestHeaders[index].value = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
      return {requestHeaders: details.requestHeaders}
    }, this.dropboxContent, ['blocking', 'requestHeaders'])

    chrome.webRequest.onCompleted.addListener((details) => {
      if (this.tabs[details.tabId]) {
        chrome.tabs.sendMessage(details.tabId, this.tabs[details.tabId])
      }
    }, this.dropboxContent)
  }

  extractAnnotationId (url) {
    if (url.includes('#')) {
      let parts = url.split('#')[1].split(':')
      if (parts[0] === 'hag') {
        return parts[1] || null
      }
    } else {
      return null
    }
  }
}

module.exports = DoiManager
