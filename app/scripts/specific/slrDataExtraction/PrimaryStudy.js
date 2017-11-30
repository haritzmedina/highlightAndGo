const _ = require('lodash')

class PrimaryStudy {
  constructor (publicationDetails, classification) {
    this.uri = publicationDetails.uri // TODO Check if has a URI
    this.doi = publicationDetails.doi || ''
    this.title = publicationDetails.title || ''
    this.author = publicationDetails.author || []
    this.classification = classification || {}
  }

  addCategoryEvidence (categoryEvidence) {
    if (_.isEmpty(this.classification[categoryEvidence.dimension])) {
      this.classification[categoryEvidence.dimension] = []
    }
    this.classification[categoryEvidence.dimension].push(categoryEvidence)
  }
}

module.exports = PrimaryStudy
