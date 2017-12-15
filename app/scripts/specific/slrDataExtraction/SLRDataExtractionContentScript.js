const $ = require('jquery')
const _ = require('lodash')
const Events = require('../../contentScript/Events')

class SLRDataExtractionContentScript {
  constructor () {
    this.linkToSLR = null
  }

  init (callback) {
    this.linkToSLR = document.createElement('a')
    this.linkToSLR.href = chrome.extension.getURL('content/slrView/index.html')
    this.linkToSLR.innerText = 'View current status'
    this.linkToSLR.target = '_blank'
    $('#groupBody').append(this.linkToSLR)
    document.addEventListener(Events.annotationCreated, (event) => {
      // Add to google sheet the current annotation
      let annotation = event.detail.annotation
      this.addClassificationToGSheet(annotation)
    })
  }

  addClassificationToGSheet (annotation) {
    // Check what type of classification is, restricted by (has this tag) or free (hasn't this tag)
    let categoryValue = null
    if (this.hasATag(annotation, 'slr:isCategoryOf')) {
      // TODO Retrieve the category belonged to
      categoryValue = _.find(annotation.tags, (tag) => {
        return tag.includes('slr:category:')
      })
    }
    console.log(categoryValue)
    // TODO Retrieve the sheet
    // TODO Search if primary study exists
    // TODO Search if primary study is already classified
    // TODO Update the spreadsheet with the corresponding value and hyperlink
  }

  destroy () {
    if (this.linkToSLR) {
      $(this.linkToSLR).remove()
    }
  }

  hasATag (annotation, tag) {
    return _.findIndex(annotation.tags, (annotationTag) => {
      return annotationTag.includes(tag)
    }) !== -1
  }
}

module.exports = SLRDataExtractionContentScript
