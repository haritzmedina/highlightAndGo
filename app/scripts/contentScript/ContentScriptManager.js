const Sidebar = require('./Sidebar')
const GroupSelector = require('./GroupSelector')
const HypothesisClientManager = require('./HypothesisClientManager')
const TextAnnotator = require('./contentAnnotators/TextAnnotator')

class ContentScriptManager {
  init () {
    window.abwa.hypothesisClientManager = new HypothesisClientManager()
    window.abwa.hypothesisClientManager.init(() => {
      window.abwa.sidebar = new Sidebar()
      window.abwa.sidebar.init(() => {
        window.abwa.groupSelector = new GroupSelector()
        window.abwa.groupSelector.init()
        window.abwa.contentAnnotator = new TextAnnotator() // TODO Depending on the type of annotator
        window.abwa.contentAnnotator.init()
      })
    })
  }
}

module.exports = ContentScriptManager
