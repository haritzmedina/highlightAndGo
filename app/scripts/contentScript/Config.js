const Config = {
  purposeReading: {
    contentAnnotator: 'text',
    namespace: 'purpose',
    sidebar: {
    },
    location: true,
    tags: {}
  },
  slrDataExtraction: {
    contentAnnotator: 'text',
    namespace: 'slr',
    sidebar: {},
    location: true,
    tags: {
      grouped: {
        group: 'dimension',
        subgroup: 'category',
        relation: 'isCategoryOf'
      }
    }
  }
}

module.exports = Config
