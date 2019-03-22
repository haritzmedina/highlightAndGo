const GuideElement = require('./GuideElement')
const _ = require('lodash')
const LanguageUtils = require('../../utils/LanguageUtils')
const jsYaml = require('js-yaml')

class Code extends GuideElement {
  constructor ({id, name, description = '', color, parentCode = null, annotation, parentLinkAnnotationId, classificationScheme = {}}) {
    super({name: name, color: color, parentElement: parentCode || classificationScheme})
    this.description = description
    this.id = id || null
    this.codes = this.childElements
    this.parentCode = parentCode
    this.parentLinkAnnotationId = parentLinkAnnotationId || null
    this.classificationScheme = classificationScheme
    this.annotation = annotation
    this.multivalued = false
    this.inductive = false
  }

  toAnnotation (target = []) {
    if (_.isEmpty(target)) {
      if (this.annotation) {
        target = this.annotation.target
      }
    }
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
        value: this.name,
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
      target: target,
      text: jsYaml.dump({description: this.description}),
      uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis()
    }
    let linkAnnotation = this.getParentLinkingAnnotation()
    return {codeAnnotation: codeAnnotation, linkAnnotation: linkAnnotation}
  }

  getParentLinkingAnnotation () {
    if (this.parentCode) {
      return {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        '@id': this.parentLinkAnnotationId,
        '@type': 'Annotation',
        motivation: 'linking',
        body: 'https://hypothes.is/api/annotations/' + this.parentCode.id,
        group: window.abwa.groupSelector.currentGroup.id,
        permissions: {
          read: ['group:' + window.abwa.groupSelector.currentGroup.id]
        },
        tags: ['motivation:linking'],
        target: [],
        'oa:target': 'https://hypothes.is/api/annotations/' + this.id,
        text: jsYaml.dump({body: 'https://hypothes.is/api/annotations/' + this.parentCode.id, target: 'https://hypothes.is/api/annotations/' + this.id}),
        uri: window.abwa.contentTypeManager.getDocumentURIToSaveInHypothesis() // TODO Think and check if this is ok
      }
    } else {
      return null
    }
  }

  getChildrenLinkingAnnotations () {
    let childrenLinkingAnnotations = []
    if (_.isArray(this.codes)) {
      for (let i = 0; i < this.codes.length; i++) {
        childrenLinkingAnnotations.push({

        })
      }
    }
  }

  /**
   * Get the ancestor code
   * @return {Code}
   */
  getAncestorCode () {
    let parent = this
    while (LanguageUtils.isInstanceOf(parent.parentElement, GuideElement)) {
      parent = parent.parentElement
    }
    if (LanguageUtils.isInstanceOf(parent, GuideElement)) {
      return parent
    }
  }

  static fromAnnotation (codeAnnotation, classificationScheme = {}) {
    let codeNameTag = _.find(codeAnnotation.tags, (tag) => {
      return tag.includes('slr:code:')
    })
    if (_.isString(codeNameTag)) {
      let name = codeNameTag.replace('slr:code:', '')
      let description = codeAnnotation.body.description // TODO, it must be retrieved from codeAnnotation.body.description
      return new Code({id: codeAnnotation.id, name: name, description: description, classificationScheme})
    }
  }

  setParentCode (code) {
    this.parentCode = code
    this.parentElement = code
  }

  getColor () {
    return this.color || 'rgba(150,150,150,0.6)'
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
