const DOM = require('../utils/DOM')
const $ = require('jquery')

const checkHypothesisLoggedIntervalInSeconds = 20 // fetch token every X seconds
const maxTries = 10 // max tries before deleting the token

class HypothesisManager {
  constructor () {
    // Define token
    this.token = null
    // Define tries before logout
    this.tries = 0
  }

  init () {
    // Try to load token for first time
    this.retrieveHypothesisToken((err, token) => {
      this.setToken(err, token)
    })

    // Create an observer to check if user is logged to hypothesis
    this.retryHypothesisTokenRetrieve()

    // Initialize replier for requests of hypothesis related metadata
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'hypothesis') {
        if (request.cmd === 'getToken') {
          sendResponse(this.token)
        }
      }
    })
  }

  retryHypothesisTokenRetrieve () {
    setInterval(() => {
      this.retrieveHypothesisToken((err, token) => {
        this.setToken(err, token)
      })
    }, checkHypothesisLoggedIntervalInSeconds * 1000)
  }

  retrieveHypothesisToken (callback) {
    let callSettings = {
      'async': true,
      'crossDomain': true,
      'url': 'https://hypothes.is/account/developer',
      'method': 'GET'
    }

    DOM.scrapElement(callSettings, '#token', (error, resultNodes) => {
      if (error) {
        callback(error)
      } else {
        if (!resultNodes[0]) {
          $.post('https://hypothes.is/account/developer', () => {
            DOM.scrapElement(callSettings, '#token', (error, resultNodes) => {
              if (error) {
                callback(error)
              } else {
                let hypothesisToken = resultNodes[0].value
                callback(null, hypothesisToken)
              }
            })
          })
        } else {
          let hypothesisToken = resultNodes[0].value
          callback(null, hypothesisToken)
        }
      }
    })
  }

  setToken (err, token) {
    if (err) {
      console.error('The token is unreachable')
      if (this.tries >= maxTries) { // The token is unreachable after some tries, probably the user is logged out
        this.token = null // Probably the website is down or the user has been logged out
        console.error('The token is deleted after unsuccessful %s tries', maxTries)
      } else {
        this.tries += 1 // The token is unreachable, add a done try
        console.debug('The token is unreachable for %s times, but is maintained %s', this.tries, this.token)
      }
    } else {
      console.debug('User is logged in Hypothesis. His token is %s', token)
      this.token = token
      this.tries = 0
    }
  }
}

module.exports = HypothesisManager
