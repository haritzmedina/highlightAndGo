const HypothesisClient = require('../../../hypothesis/HypothesisClient')
require('bootstrap')

class Purpose {
  constructor () {
    this.hypothesisClient = new HypothesisClient()
  }

  init () {
    console.debug('Initializing purpose annotator')
    // TODO Create a lateral panel
    document.addEventListener('select', (e) => {
      console.log(e)
    })
  }
}

module.exports = Purpose
