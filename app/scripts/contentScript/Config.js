const Config = {
  purposeReading: {
    namespace: 'purpose',
    sidebar: {
      tags: {},
      location: true
    },
    contentAnnotator: 'text'
  },
  slrDataExtraction: {
    namespace: 'slr',
    sidebar: {
      tags: {
        grouped: {
          group: 'dimension',
          subgroup: 'category',
          relation: 'isCategoryOf'
        }
      }
    },
    contentAnnotator: 'text'
  }
}

module.exports = Config
