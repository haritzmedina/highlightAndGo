const _ = require('lodash')

const HypothesisClientManager = require('../hypothesis/HypothesisClientManager')
const GoogleSheetParser = require('./GoogleSheetParser')
const HypothesisGroupInitializer = require('./HypothesisGroupInitializer')

class GoogleSheetContentScriptManager {
  init () {
    window.hag.hypothesisClientManager = new HypothesisClientManager()
    window.hag.hypothesisClientManager.init(() => {
      this.initLoginProcess((err, tokens) => {
        if (err) {
          window.alert(chrome.i18n.getMessage('Failed login to services'))
        } else {
          console.debug('Correctly logged in to hypothesis: %s', tokens.hypothesis)
          console.debug('Correctly logged in to gSheet: %s', tokens.gSheet)
          this.initGoogleSheetParsing(() => {
            debugger
          })
        }
      })
    })
  }

  initLoginProcess (callback) {
    if (!window.hag.hypothesisClientManager.isLoggedIn()) {
      if (confirm(chrome.i18n.getMessage('HypothesisLoginRequired'))) {
        // Promise if user is not logged in hypothesis
        this.askUserToLogInHypothesis((hypothesisToken) => {
          this.askUserToLogInSheets((gSheetToken) => {
            if (_.isFunction(callback)) {
              callback(null, {
                hypothesis: window.hag.hypothesisClientManager.hypothesisToken,
                gSheet: gSheetToken
              })
            }
          })
        })
      } else {
        if (_.isFunction(callback)) {
          callback(new Error('Unable to login in hypothesis'))
        }
      }
    } else {
      this.askUserToLogInSheets((gSheetToken) => {
        if (_.isFunction(callback)) {
          callback(null, {
            hypothesis: window.hag.hypothesisClientManager.hypothesisToken,
            gSheet: gSheetToken
          })
        }
      })
    }
  }

  initGoogleSheetParsing (callback) {
    window.hag.googleSheetParser = new GoogleSheetParser()
    window.hag.googleSheetParser.parse((err, parsedSheetData) => {
      if (err) {
        console.error(err)
      } else {
        window.hag.HypothesisGroupInitializer = new HypothesisGroupInitializer()
        window.hag.HypothesisGroupInitializer.init(parsedSheetData, () => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      }
    })
  }

  askUserToLogInHypothesis (callback) {
    // Send ask cuestion
    chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'userLoginForm'}, () => {
      window.hag.hypothesisClientManager.reloadHypothesisClient(() => {
        if (_.isFunction(callback)) {
          callback(window.hag.hypothesisClientManager.hypothesisToken)
        }
      })
    })
  }

  askUserToLogInSheets (callback) {
    // Promise if user has not given permissions in google sheets
    chrome.runtime.sendMessage({scope: 'googleSheets', cmd: 'getTokenSilent'}, (token) => {
      if (token) {
        if (_.isFunction(callback)) {
          callback(token)
        }
      } else {
        if (confirm(chrome.i18n.getMessage('GoogleSheetLoginRequired'))) {
          chrome.runtime.sendMessage({scope: 'googleSheets', cmd: 'getToken'}, (token) => {
            if (_.isFunction(callback)) {
              callback(token)
            }
          })
        }
      }
    })
  }
}

module.exports = GoogleSheetContentScriptManager
