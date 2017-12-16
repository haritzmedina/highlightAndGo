const _ = require('lodash')

class HypothesisGroupInitializer {
  init (parsedSheetData, callback) {
    this.initializeHypothesisGroup(() => {
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  initializeHypothesisGroup () {
    // TODO Get if current hypothesis group exists
    window.hag.hypothesisClientManager.hypothesisClient.getUserProfile((userProfile) => {
      debugger
    })
    // TODO Create the group if not exists
  }

  createHypothesisGroup () {
    // TODO Create dimensions and categories annotations
    // TODO Create relation to sheet annotation
  }

  updateHypothesisGroup () {

  }

  disableExtensionButton () {

  }
}

module.exports = HypothesisGroupInitializer
