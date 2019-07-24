const ClassificationScheme = require('../model/schema/ClassificationScheme')
const _ = require('lodash')

class MappingStudyManager {
  constructor () {
    this.classificationScheme = null
    this.classificationSchemeAnnotations = null
  }

  init (callback) {
    // Retrieve mapping study scheme annotations
    this.retrieveAnnotationsForClassificationScheme((err, classificationSchemeAnnotations) => {
      if (err) {
        callback(err)
      } else {
        this.classificationSchemeAnnotations = classificationSchemeAnnotations
        this.classificationScheme = ClassificationScheme.fromAnnotations(classificationSchemeAnnotations)
        this.storageMetadata = window.abwa.storageManager.getStorageMetadata()
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  retrieveAnnotationsForClassificationScheme (callback) {
    window.abwa.storageManager.client.searchAnnotations({
      tag: 'motivation:slr:codebookDevelopment',
      group: window.abwa.groupSelector.currentGroup.id,
      sort: 'created',
      order: 'asc'
    }, (err, codebookAnnotations) => {
      if (err) {
        callback(err)
      } else {
        window.abwa.storageManager.client.searchAnnotations({
          tag: 'motivation:linking',
          group: window.abwa.groupSelector.currentGroup.id
        }, (err, linkingAnnotations) => {
          if (err) {
            callback(err)
          } else {
            callback(null, linkingAnnotations.concat(codebookAnnotations))
          }
        })
      }
    })
  }

  destroy () {
    this.classificationScheme = null
    this.classificationSchemeAnnotations = null
  }
}

module.exports = MappingStudyManager
