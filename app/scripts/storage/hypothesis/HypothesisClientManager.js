const _ = require('lodash')

const HypothesisClient = require('hypothesis-api-client')

const StorageManager = require('../StorageManager')

const reloadIntervalInSeconds = 10 // Reload the hypothesis client every 10 seconds

const Alerts = require('../../utils/Alerts')

class HypothesisClientManager extends StorageManager {
  constructor () {
    super()
    this.client = null
    this.hypothesisToken = null
    this.storageUrl = 'https://hypothes.is'
    this.reloadInterval = null
  }

  init (callback) {
    this.reloadClient(() => {
      // Start reloading of client
      this.reloadInterval = setInterval(() => {
        this.reloadClient()
      }, reloadIntervalInSeconds * 1000)
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  reloadClient (callback) {
    if (_.has(window.background, 'hypothesisManager')) {
      if (_.isString(window.background.hypothesisManager.token)) {
        if (this.hypothesisToken !== window.background.hypothesisManager.token) {
          this.hypothesisToken = window.background.hypothesisManager.token
          if (this.hypothesisToken) {
            this.client = new HypothesisClient(window.background.hypothesisManager.token)
          } else {
            this.client = new HypothesisClient()
          }
        }
        if (_.isFunction(callback)) {
          callback()
        }
      } else {
        window.background.hypothesisManager.retrieveHypothesisToken((err, token) => {
          if (err) {
            this.client = new HypothesisClient()
            this.hypothesisToken = null
          } else {
            this.client = new HypothesisClient(token)
            this.hypothesisToken = token
          }
        })
      }
    } else {
      chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getToken'}, (token) => {
        if (this.hypothesisToken !== token) {
          this.hypothesisToken = token
          if (this.hypothesisToken) {
            this.client = new HypothesisClient(token)
          } else {
            this.client = new HypothesisClient()
          }
        }
        if (_.isFunction(callback)) {
          callback()
        }
      })
    }
  }

  isLoggedIn (callback) {
    if (_.isFunction(callback)) {
      let isLoggedIn = _.isString(this.hypothesisToken)
      callback(null, isLoggedIn)
    }
  }

  logIn (callback) {
    // TODO Check if user grant permission to access hypothesis account
    this.isLoggedIn((err, isLoggedIn) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(new Error('Error while checking if the user is logged in or not.'))
        }
      } else {
        if (!isLoggedIn) {
          this.askUserToLogIn((err, token) => {
            if (err) {
              if (_.isFunction(callback)) {
                callback(err)
              }
            } else {
              if (_.isFunction(callback)) {
                callback(null)
              }
            }
          })
        } else {
          if (_.isFunction(callback)) {
            callback(null)
          }
        }
      }
    })
  }

  askUserToLogIn (callback) {
    Alerts.confirmAlert({
      title: 'Hypothes.is login required',
      text: chrome.i18n.getMessage('HypothesisLoginRequired'),
      alertType: Alerts.alertType.info,
      callback: () => {
        // Prompt hypothesis login form
        chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'userLoginForm'}, (result) => {
          if (result.error) {
            if (_.isFunction(callback)) {
              callback(new Error(result.error))
            }
          } else {
            this.reloadClient(() => {
              if (_.isFunction(callback)) {
                callback(null, this.hypothesisToken)
              }
            })
          }
        })
      },
      cancelCallback: () => {
        if (_.isFunction(callback)) {
          callback(new Error('User don\'t want to log in hypothes.is'))
        }
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
