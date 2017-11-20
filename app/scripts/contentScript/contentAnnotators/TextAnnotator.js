const ContentAnnotator = require('./ContentAnnotator')
const $ = require('jquery')

class TextAnnotator extends ContentAnnotator {
  init () {
    document.addEventListener('mouseup', () => {
      // Check if something is selected
      if (document.getSelection().toString().length !== 0) {
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0) {
          this.openSidebar()
        }
      } else {
        console.debug('Current selection is empty') // TODO Show user message
        // If selection is child of sidebar, return null
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0) {
          console.debug('Current selection is child of the annotator sidebar') // TODO Show user message
          this.closeSidebar()
        }
      }
    })
  }
}

module.exports = TextAnnotator
