const Annotators = require('../background/Annotators')

class AnnotatorMenu {
  constructor () {
    this.annotationContainerMenu = document.querySelector('#annotationMenu')
  }

  init () {
    // Visualize container
    this.annotationContainerMenu.dataset.active = 'true'
    // Get current annotator
    chrome.runtime.sendMessage({scope: 'extension', cmd: 'getCurrentAnnotator'}, (currentAnnotator) => {
      console.log(currentAnnotator)
      // Set default value for dropdown
      if (currentAnnotator) {
        let dropdown = document.querySelector('#annotationDropdownMenu')
        dropdown.innerText = currentAnnotator.name
      }
      // Add event listeners
      let dropdownItems = this.annotationContainerMenu.querySelectorAll('.dropdown-item')
      dropdownItems.forEach(dropdownItem => {
        dropdownItem.addEventListener('click', () => {
          chrome.runtime.sendMessage({
            scope: 'extension',
            cmd: 'setAnnotator',
            params: {annotator: Annotators[dropdownItem.id]}}, (done) => {
            console.log(done)
            if (done) {
              console.log('Switched to annotator %s', dropdownItem.id)
              window.close()
            }
          })
        })
      })
    })
  }
}

module.exports = AnnotatorMenu
