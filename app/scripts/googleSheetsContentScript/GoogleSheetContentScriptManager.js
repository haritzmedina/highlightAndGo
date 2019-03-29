const _ = require('lodash')

const HypothesisClientManager = require('../hypothesis/HypothesisClientManager')
const GoogleSheetsClientManager = require('../googleSheets/GoogleSheetsClientManager')

const Alerts = require('../utils/Alerts')

class GoogleSheetContentScriptManager {
  init (callback) {
    window.hag.googleSheetClientManager = new GoogleSheetsClientManager()
    window.hag.hypothesisClientManager = new HypothesisClientManager()
    window.hag.hypothesisClientManager.init(() => {
      this.initLoginProcess((err, tokens) => {
        if (err) {
          Alerts.errorAlert({title: 'Oops!', text: 'Unable to configure current spreadsheet. Failed login to services.'}) // TODO i18n
          if (_.isFunction(callback)) {
            callback()
          }
        } else {
          // TODO Show current hypothes.is groups with annotations of highlight&Go
        }
      })
    })
  }

  initLoginProcess (callback) {
    window.hag.hypothesisClientManager.logInHypothesis((err, hypothesisToken) => {
      if (err) {
        callback(err)
      } else {
        window.hag.googleSheetClientManager.logInGoogleSheets((err, gSheetToken) => {
          if (err) {
            callback(err)
          } else {
            callback(null, {
              hypothesis: hypothesisToken,
              gSheet: gSheetToken
            })
          }
        })
      }
    })
  }
}

module.exports = GoogleSheetContentScriptManager
