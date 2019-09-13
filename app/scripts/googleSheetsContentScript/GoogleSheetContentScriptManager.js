const _ = require('lodash')

const HypothesisClientManager = require('../storage/hypothesis/HypothesisClientManager')
const LocalStorageManager = require('../storage/local/LocalStorageManager')
const GoogleSheetsClientManager = require('../googleSheets/GoogleSheetsClientManager')

const Alerts = require('../utils/Alerts')

class GoogleSheetContentScriptManager {
  init (callback) {
    window.hag.googleSheetClientManager = new GoogleSheetsClientManager()
    this.loadStorage((err) => {
      if (err) {

      } else {
        this.initLoginProcess((err) => {
          if (err) {
            Alerts.errorAlert({title: 'Oops!', text: 'Unable to configure current spreadsheet. Failed login to services.'}) // TODO i18n
            if (_.isFunction(callback)) {
              callback()
            }
          } else {
            // TODO Show current hypothes.is groups with annotations of highlight&Go
          }
        })
      }
    })
  }

  initLoginProcess (callback) {
    window.hag.storageManager.logIn((err) => {
      if (err) {
        callback(err)
      } else {
        window.hag.googleSheetClientManager.logInGoogleSheets((err) => {
          if (err) {
            callback(err)
          } else {
            callback(null)
          }
        })
      }
    })
  }

  loadStorage (callback) {
    chrome.runtime.sendMessage({scope: 'storage', cmd: 'getSelectedStorage'}, ({storage}) => {
      if (storage === 'hypothesis') {
        // Hypothesis
        window.abwa.storageManager = new HypothesisClientManager()
      } else {
        // Local storage
        window.abwa.storageManager = new LocalStorageManager()
      }
      window.abwa.storageManager.init((err) => {
        if (_.isFunction(callback)) {
          if (err) {
            callback(err)
          } else {
            callback()
          }
        }
      })
    })
  }
}

module.exports = GoogleSheetContentScriptManager
