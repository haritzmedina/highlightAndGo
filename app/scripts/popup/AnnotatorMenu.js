class AnnotatorMenu {
  constructor () {
    this.annotationContainerMenu = document.querySelector('#annotationMenu')
  }

  init () {
    // Visualize container
    this.annotationContainerMenu.dataset.active = 'true'
    // Get current annotator
    chrome.runtime.sendMessage({scope: 'extension', cmd: 'getCurrentAnnotator'}, (mode) => {
      // Add event listeners

    })
  }
}

module.exports = AnnotatorMenu
