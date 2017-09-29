const DOM = require('../utils/DOM')
const $ = require('jquery')

const checkHypothesisLoggedIntervalInSeconds = 20

class HypothesisManager {
  constructor () {
    // Define token
    this.token = null
  }

  init () {
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
        if (err) {
          console.error('User is not logged in Hypothesis')
          this.token = null
        } else {
          console.debug('User is logged in Hypothesis. His token is %s', token)
          this.token = token
        }
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
}

module.exports = HypothesisManager
