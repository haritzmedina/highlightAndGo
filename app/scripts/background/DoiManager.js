const DOI = require('doi-regex')

class DoiManager {
  constructor () {
    this.urlFilterObject = { 'urls': ['*://*.doi.org/*', '*://doi.org/*'] }
  }

  init () {
    chrome.webRequest.onHeadersReceived.addListener((responseDetails) => {
      console.log(responseDetails)
      // Retrieve doi from call
      let doi = DOI.groups(responseDetails.url)[1]
      let annotationId = this.extractAnnotationId(responseDetails.url)
      let redirectUrl = responseDetails.responseHeaders[2].value
      redirectUrl += '#doi:' + doi
      if (annotationId) {
        redirectUrl += '&hag:' + annotationId
      }
      responseDetails.responseHeaders[2].value = redirectUrl
      return {responseHeaders: responseDetails.responseHeaders}
    }, this.urlFilterObject, ['responseHeaders', 'blocking'])
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
