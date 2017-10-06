const Modes = {
  edit: {
    id: 'edit',
    name: 'Edit',
    description: 'Define annotations'
  },
  view: {
    id: 'view',
    name: 'View',
    description: 'View augmented site.'
  },
  original: {
    id: 'original',
    name: 'Original',
    description: 'View the original site, without augmentations or editor'
  },
  'annotation': {
    id: 'annotation',
    name: 'Annotation',
    description: 'Annotate the web content using a custom annotator'
  }
}

module.exports = Modes
