const GoogleSheetClient = require('../googleSheets/GoogleSheetClient')
const ChromeStorage = require('../utils/ChromeStorage')

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
        } else if (request.cmd === 'getTokenSilent') {
          chrome.identity.getAuthToken({ 'interactive': false }, function (token) {
            if (chrome.runtime.lastError) {
              sendResponse({error: chrome.runtime.lastError})
            } else {
              sendResponse({token: token})
            }
          })
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
        } else if (request.cmd === 'updateSpreadsheet') {
          chrome.identity.getAuthToken({ 'interactive': true }, function (token) {
            this.googleSheetClient = new GoogleSheetClient(token)
            this.googleSheetClient.updateSheetCells(request.data, (err, result) => {
              if (err) {
                sendResponse({error: err})
              } else {
                sendResponse(result)
              }
            })
          })
        } if (request.cmd === 'getPreferences') {
          ChromeStorage.getData('gsheet.preferences', ChromeStorage.sync, (err, preferences) => {
            if (err) {
              sendResponse({err: err})
            } else {
              if (preferences) {
                let parsedPreferences = JSON.parse(preferences.data)
                sendResponse({preferences: parsedPreferences || {}})
              } else {
                sendResponse({preferences: {}})
              }
            }
          })
        } else if (request.cmd === 'setPreferences') {
          let preferences = request.data.preferences
          ChromeStorage.setData('gsheet.preferences', {data: JSON.stringify(preferences)}, ChromeStorage.sync, (err) => {
            if (err) {
              sendResponse({err: err})
            } else {
              sendResponse({preferences: preferences})
            }
          })
        }
        return true
      }
    })
  }
}

module.exports = GoogleSheetsManager
