const _ = require('lodash')

const HypothesisClient = require('hypothesis-api-client')

const reloadIntervalInSeconds = 10 // Reload the hypothesis client every 10 seconds

class HypothesisClientManager {
  constructor () {
    this.hypothesisClient = null
    this.hypothesisToken = null
    this.reloadInterval = null
  }

  init (callback) {
    this.reloadHypothesisClient(() => {
      // Start reloading of client
      this.reloadInterval = setInterval(() => {
        this.reloadHypothesisClient()
      }, reloadIntervalInSeconds * 1000)
      if (_.isNull(this.hypothesisToken)) {
        if (_.isFunction(callback)) {
          callback(new Error('User is not logged in'))
        }
      } else {
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  reloadHypothesisClient (callback) {
    chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getToken'}, (token) => {
      if (!_.isNull(token)) {
        if (this.hypothesisToken !== token) {
          this.hypothesisToken = token
          this.hypothesisClient = new HypothesisClient(token)
        }
      } else {
        this.hypothesisToken = null
        this.hypothesisClient = new HypothesisClient()
      }
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  isLoggedIn () {
    return !_.isEmpty(this.hypothesisToken)
  }

  logInHypothesis (callback) {
    // TODO Check if user grant permission to access hypothesis account
    if (!window.hag.hypothesisClientManager.isLoggedIn()) {
      this.askUserToLogInHypothesis((err, token) => {
        if (err) {
          callback(err)
        } else {
          callback(null, token)
        }
      })
    } else {
      callback(null, window.hag.hypothesisClientManager.hypothesisToken)
    }
  }

  askUserToLogInHypothesis (callback) {
    let swal = require('sweetalert2')
    // Ask question
    swal({
      title: 'Hypothes.is login required', // TODO i18n
      text: chrome.i18n.getMessage('HypothesisLoginRequired'),
      type: 'info',
      showCancelButton: true
    }).then((result) => {
      if (result.value) {
        // Prompt hypothesis login form
        chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'userLoginForm'}, (result) => {
          if (result.error) {
            if (_.isFunction(callback)) {
              callback(new Error(result.error))
            }
          } else {
            window.hag.hypothesisClientManager.reloadHypothesisClient(() => {
              if (_.isFunction(callback)) {
                callback(null, window.hag.hypothesisClientManager.hypothesisToken)
              }
            })
          }
        })
      } else {
        callback(new Error('User don\'t want to log in hypothes.is'))
      }
    })
  }

  destroy (callback) {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval)
    }
    if (_.isFunction(callback)) {
      callback()
    }
  }
}

module.exports = HypothesisClientManager
