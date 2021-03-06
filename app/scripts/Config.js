const Config = {
  slrDataExtraction: {
    contentAnnotator: 'text', // Type of content annotator
    namespace: 'slr', // Namespace for the annotations
    sidebar: {},
    location: true, // Location mode
    userFilter: true,
    tags: { // Defined tags for the domain
      grouped: { // Grouped annotations
        group: 'facet',
        subgroup: 'code',
        relation: 'isCodeOf'
      },
      statics: { // Other static tags specific for the domain
        multivalued: 'multivalued',
        inductive: 'inductive',
        validated: 'validated',
        spreadsheet: 'spreadsheet'
      }
    },
    colors: {
      type: 'random',
      minAlpha: 0.3,
      maxAlpha: 0.8
    }
  }
}

module.exports = Config
