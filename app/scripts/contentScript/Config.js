const Config = {
  purposeReading: {
    sidebar: {
      tags: {
        namespace: 'purpose'
      },
      location: true
    },
    contentAnnotator: 'text'
  },
  slrDataExtraction: {
    sidebar: {
      tags: {
        namespace: 'mappingStudy',
        grouped: {
          group: 'dimension',
          subgroup: 'category',
          relation: 'isCategoryOf',
          recursive: false
        }
      }
    },
    contentAnnotator: 'text'
  }
}

module.exports = Config
