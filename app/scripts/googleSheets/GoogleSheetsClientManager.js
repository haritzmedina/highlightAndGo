const swal = require('sweetalert2')
const _ = require('lodash')

class GoogleSheetsClientManager {
  /**
   * Login in google sheets and ask user if not logged in
   * @param {LoginCallback} callback - The callback for the response to log in google sheets
   */
  logInGoogleSheets (callback) {
    // Promise if user has not given permissions in google sheets
    chrome.runtime.sendMessage({scope: 'googleSheets', cmd: 'getTokenSilent'}, (result) => {
      if (result.token) {
        if (_.isFunction(callback)) {
          callback(null, result.token)
        }
      } else {
        this.askUserToLogInGoogleSheets((err, token) => {
          if (err) {
            callback(err)
          } else {
            callback(null, token)
          }
        })
      }
    })
  }

  /**
   * Ask user to log in google sheets
   * @param callback
   */
  askUserToLogInGoogleSheets (callback) {
    swal({
      title: 'Google sheets login required', // TODO i18n
      text: chrome.i18n.getMessage('GoogleSheetLoginRequired'),
      type: 'info',
      showCancelButton: true
    }).then((result) => {
      if (result.value) {
        chrome.runtime.sendMessage({scope: 'googleSheets', cmd: 'getToken'}, (result) => {
          if (result.error) {
            if (_.isFunction(callback)) {
              callback(result.error)
            }
          } else {
            if (_.isFunction(callback)) {
              callback(null, result.token)
            }
          }
        })
      } else {
        callback(new Error('User don\'t want to log in google sheets'))
      }
    })
  }
}

module.exports = GoogleSheetsClientManager
