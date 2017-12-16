class GoogleSheetsManager {
  init () {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'googleSheets') {
        if (request.cmd === 'getToken') {
          chrome.identity.getAuthToken({ 'interactive': true }, function (token) {
            sendResponse(token)
          })
          return true
        } else if (request.cmd === 'getTokenSilent') {
          chrome.identity.getAuthToken({ 'interactive': false }, function (token) {
            sendResponse(token)
          })
          return true
        }
      }
    })
  }
}

module.exports = GoogleSheetsManager
