const Sidebar = require('./Sidebar')
const TextAnnotator = require('./contentAnnotators/TextAnnotator')

class ContentScriptManager {
  init () {
    window.abwa.sidebar = new Sidebar()
    window.abwa.sidebar.init(() => {
      window.abwa.contentAnnotator = new TextAnnotator() // TODO Depending on the type of annotator
      window.abwa.contentAnnotator.init()
    })
  }
}

module.exports = ContentScriptManager
