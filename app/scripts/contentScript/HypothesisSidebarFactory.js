class HypothesisSidebarFactory {
  static insertHypothesisSidebar () {
    if (HypothesisSidebarFactory.Inserted) {
      console.debug('Hypothesis sidebar is already inserted')
    } else {
      require('hypothesis')
    }
  }
}

HypothesisSidebarFactory.Inserted = false

module.exports = HypothesisSidebarFactory
