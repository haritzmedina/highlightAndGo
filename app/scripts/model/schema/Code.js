const GuideElement = require('./GuideElement')
const _ = require('lodash')
const LanguageUtils = require('../../utils/LanguageUtils')
const jsYaml = require('js-yaml')

class Code extends GuideElement {
  constructor ({id, name, description = '', color, parentCode = null, annotation, parentLinkAnnotationId, classificationScheme = {}, multivalued = false, uri, uris, creator}) {
    super({name: name, color: color, parentElement: parentCode || classificationScheme})
    this.description = description
    this.id = id || null
    this.codes = this.childElements
    this.parentCode = parentCode
    this.parentLinkAnnotationId = parentLinkAnnotationId || null
    this.classificationScheme = classificationScheme
    this.annotation = annotation
    this.multivalued = multivalued
    this.uri = uri || window.abwa.contentTypeManager.getDocumentURIToSaveInStorage()
    this.uris = uris || window.abwa.contentTypeManager.getDocumentURIs() || [this.uri]
    this.creator = creator
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
      creator: this.creator || window.abwa.groupSelector.getCreatorData() || '',
      motivation: 'slr:codebookDevelopment',
      body: {
        '@type': 'SpecificResource',
        value: this.name,
        description: this.description || '',
        multivalued: this.multivalued
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
      uris: this.uris || window.abwa.contentTypeManager.getDocumentURIs(),
      target: target,
      text: '',
      uri: this.uri || window.abwa.contentTypeManager.getDocumentURIToSaveInStorage()
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
        body: window.abwa.storageManager.storageMetadata.annotationUrl + this.parentCode.id,
        group: window.abwa.groupSelector.currentGroup.id,
        permissions: {
          read: ['group:' + window.abwa.groupSelector.currentGroup.id]
        },
        tags: ['motivation:linking'],
        target: [],
        'oa:target': window.abwa.storageManager.storageMetadata.annotationUrl + this.id,
        text: jsYaml.dump({body: window.abwa.storageManager.storageMetadata.annotationUrl + this.parentCode.id, target: window.abwa.storageManager.storageMetadata.annotationUrl + this.id}),
        uri: this.uri || window.abwa.contentTypeManager.getDocumentURIToSaveInStorage()
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
      let name = codeAnnotation.body.value || codeNameTag.replace('slr:code:', '')
      let description = codeAnnotation.body.description
      let multivalued = codeAnnotation.body.multivalued || false
      return new Code({
        id: codeAnnotation.id,
        name: name,
        description: description,
        classificationScheme,
        annotation: codeAnnotation,
        uri: codeAnnotation.uri,
        uris: codeAnnotation.uris,
        creator: codeAnnotation.creator,
        multivalued: multivalued
      })
    }
  }

  setParentCode (code) {
    this.parentCode = code
    this.parentElement = code
  }

  getColor () {
    return this.color || 'rgba(150,150,150,0.6)'
  }

  /**
   * Returns if this is parent code of code
   * @param code
   * @return {boolean}
   */
  isParentOf (code) {
    let children = this.getAllChildCodes()
    return _.includes(children, code)
  }

  /**
   * Returns if this is child code of code
   * @param code
   * @return {boolean}
   */
  isChildOf (code) {
    let children = code.getAllChildCodes()
    return _.includes(children, this)
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
