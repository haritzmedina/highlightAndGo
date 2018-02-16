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
        group: 'facet',
        subgroup: 'code',
        relation: 'isCodeOf'
      },
      statics: {
        multivalued: 'multivalued',
        inductive: 'inductive',
        validated: 'validated',
        spreadsheet: 'spreadsheet'
      }
    }
  }
}

module.exports = Config
