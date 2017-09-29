const $ = require('jquery')

class HypothesisSidebarFactory {
  static insertHypothesisSidebar () {
    if (HypothesisSidebarFactory.Inserted) {
      console.debug('Hypothesis sidebar is already inserted')
    } else {
      // Load Hypothesis client sidebar
      let s = document.createElement('script')
      s.type = 'text/javascript'
      s.src = 'https://hypothes.is/embed.js'
      s.async = 'async'
      $('body').append(s)
      console.debug('Hypothesis sidebar inserted')
      HypothesisSidebarFactory.Inserted = true
    }
  }
}

HypothesisSidebarFactory.Inserted = false

module.exports = HypothesisSidebarFactory
