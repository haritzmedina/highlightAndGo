const HypothesisSidebarFactory = require('./HypothesisSidebarFactory')

class EditManager {
  init () {
    // Open hypothesis client (sidebar)
    HypothesisSidebarFactory.insertHypothesisSidebar()
  }
}

module.exports = EditManager
