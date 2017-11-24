const ContentAnnotator = require('./ContentAnnotator')
const GroupSelector = require('../GroupSelector')
const $ = require('jquery')
const _ = require('lodash')

class TextAnnotator extends ContentAnnotator {
  constructor (config) {
    super()
    this.events = {}
    this.events.mouseUpOnDocumentHandler = null
  }

  init (callback) {
    this.initSelectionEvents(() => {
      this.initGroupChangeHandler(() => {
        // TODO Load annotations for first time
        this.loadAnnotations(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    })
  }

  initSelectionEvents (callback) {
    this.events.mouseUpOnDocumentHandler = this.mouseUpOnDocumentHandlerConstructor()
    document.addEventListener('mouseup', this.events.mouseUpOnDocumentHandler)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  initGroupChangeHandler (callback) {
    this.events.hypothesisGroupChangedHandler = this.hypothesisGroupChangedHandlerConstructor()
    document.addEventListener(GroupSelector.eventGroupChange, this.hypothesisGroupChangedHandler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  hypothesisGroupChangedHandlerConstructor () {
    return (event) => {
      console.log('HypothesisGroupChanged')
      console.log(event.detail)
    }
  }

  loadAnnotations (callback) {
    if (_.isFunction(callback)) {
      callback()
    }
  }

  mouseUpOnDocumentHandlerConstructor () {
    return () => {
      // Check if something is selected
      if (document.getSelection().toString().length !== 0) {
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0) {
          this.openSidebar()
        }
      } else {
        console.debug('Current selection is empty')
        // If selection is child of sidebar, return null
        if ($(event.target).parents('#abwaSidebarWrapper').toArray().length === 0) {
          console.debug('Current selection is not child of the annotator sidebar')
          this.closeSidebar()
        }
      }
    }
  }

  closeSidebar () {
    super.closeSidebar()
  }

  openSidebar () {
    super.openSidebar()
  }

  destroy () {
    // Remove event listener
    document.removeEventListener(GroupSelector.eventGroupChange, this.events.hypothesisGroupChangedHandler)
    document.removeEventListener('mouseup', this.events.mouseUpOnDocumentHandler)
  }
}

module.exports = TextAnnotator
