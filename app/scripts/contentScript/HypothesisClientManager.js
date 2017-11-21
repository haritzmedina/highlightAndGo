const HypothesisClient = require('../hypothesis/HypothesisClient')
const _ = require('lodash')

const reloadIntervalInSeconds = 10 // Reload the hypothesis client every 10 seconds

class HypothesisClientManager {
  constructor () {
    this.hypothesisClient = null
    this.hypothesisToken = null
  }

  init (callback) {
    this.reloadHypothesisClient(() => {
      // Start reloading of client
      setInterval(() => {
        this.reloadHypothesisClient()
      }, reloadIntervalInSeconds * 1000)
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  reloadHypothesisClient (callback) {
    chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getToken'}, (token) => {
      if (this.hypothesisToken !== token) {
        this.hypothesisToken = token
        if (this.hypothesisToken) {
          this.hypothesisClient = new HypothesisClient(token)
        } else {
          this.hypothesisClient = new HypothesisClient()
        }
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  isLoggedIn () {
    return !_.isEmpty(this.hypothesisToken)
  }
}

module.exports = HypothesisClientManager
