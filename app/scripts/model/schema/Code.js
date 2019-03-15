const GuideElement = require('./GuideElement')
const _ = require('lodash')
const LanguageUtils = require('../../utils/LanguageUtils')
const jsYaml = require('js-yaml')

class Code extends GuideElement {
  constructor ({id, name, description = '', color, parentCode = null, annotation, parentLinkId, classificationScheme = {}}) {
    super({name: name, color: color, parentElement: parentCode || classificationScheme})
    this.description = description
    this.id = id || null
    this.codes = this.childElements
    this.parentCode = parentCode
    this.parentLinkId = parentLinkId || null
    this.classificationScheme = classificationScheme
    this.annotation = annotation
    this.multivalued = false
    this.inductive = false
  }

  toAnnotation () {
    let codeAnnotation = {
      '@context': [
        {'oa': 'http://www.w3.org/ns/anno.jsonld'},
        {'slr': 'http://slr.onekin.org/ns/slr.jsonld'}
      ],
      '@id': this.id || '',
      '@type': 'Annotation',
      motivation: 'slr:codebookDevelopment',
      body: {
        '@type': 'SpecificResource',
        value: name,
        description: this.description || ''
      },
      group: window.abwa.groupSelector.currentGroup.id,
      permissions: {
        read: ['group:' + window.abwa.groupSelector.currentGroup.id]
      },
      references: [],
      tags: [
        'motivation:slr:codebookDevelopment',
        'slr:code:' + LanguageUtils.normalizeString(this.name)
      ],
      target: [],
      text: jsYaml.dump({description: this.description}),
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
    }
    let linkAnnotation = null
    if (this.parentCode) {
      linkAnnotation = {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        '@id': this.parentLinkId,
        '@type': 'Annotation',
        motivation: 'linking',
        body: 'https://hypothes.is/api/annotation/' + this.parentCode.id,
        target: [ {
          source: 'https://hypothes.is/api/annotation/' + this.id
        }],
        uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
      }
    }
    return {codeAnnotation: codeAnnotation, linkAnnotation: linkAnnotation}
  }

  static fromAnnotation (codeAnnotation, classificationScheme = {}) {
    let codeNameTag = _.find(codeAnnotation.tags, (tag) => {
      return tag.includes('slr:code:')
    })
    if (_.isString(codeNameTag)) {
      let name = codeNameTag.replace('slr:code:', '')
      let description = codeAnnotation.text
      return new Code({id: codeAnnotation.id, name: name, description: description, classificationScheme})
    }
  }

  setParentCode (code) {
    this.parentCode = code
    this.parentElement = code
  }

  getColor () {
    return 'rgba(150,150,150,1)' // TODO Change
  }

  getAllChildCodes () {
    let childCodes = this.codes
    for (let i = 0; i < this.codes.length; i++) {
      childCodes = childCodes.concat(this.codes[i].getAllChildCodes())
    }
    return childCodes
  }
}

Code.types =

module.exports = Code
