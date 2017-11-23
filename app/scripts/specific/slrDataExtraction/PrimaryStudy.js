class PrimaryStudy {
  constructor (publicationDetails, classification) {
    this.doi = publicationDetails.doi || ''
    this.title = publicationDetails.title || ''
    this.author = publicationDetails.author || []
    this.classification = classification || []
  }

  addCategoryEvidence (categoryEvidence) {
    this.classification.push(categoryEvidence) // TODO Review same dimension multiple category
  }
}

module.exports = PrimaryStudy
