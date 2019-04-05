const GoogleSheetClient = require('../googleSheets/GoogleSheetClient')

class GoogleSheetsManager {
  constructor () {
    this.googleSheetClient = null
  }

  init () {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'googleSheets') {
        if (request.cmd === 'getToken') {
          chrome.identity.getAuthToken({ 'interactive': true }, function (token) {
            if (chrome.runtime.lastError) {
              sendResponse({error: chrome.runtime.lastError})
            } else {
              sendResponse({token: token})
            }
          })
          return true
        } else if (request.cmd === 'getTokenSilent') {
          chrome.identity.getAuthToken({ 'interactive': false }, function (token) {
            if (chrome.runtime.lastError) {
              sendResponse({error: chrome.runtime.lastError})
            } else {
              sendResponse({token: token})
            }
          })
          return true
        } else if (request.cmd === 'createSpreadsheet') {
          chrome.identity.getAuthToken({ 'interactive': true }, function (token) {
            this.googleSheetClient = new GoogleSheetClient(token)
            this.googleSheetClient.createSpreadsheet(request.data, (err, result) => {
              if (err) {
                sendResponse({error: err})
              } else {
                sendResponse(result)
              }
            })
          })
          return true
        }
      }
    })
  }
}

module.exports = GoogleSheetsManager
