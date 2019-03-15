const ClassificationScheme = require('../model/schema/ClassificationScheme')
const _ = require('lodash')

class MappingStudyManager {
  constructor () {
    this.classificationScheme = null
  }

  init (callback) {
    // Retrieve mapping study scheme annotations
    this.retrieveAnnotationsForClassificationScheme((err, classificationSchemeAnnotations) => {
      if (err) {
        callback(err)
      } else {
        this.classificationScheme = ClassificationScheme.fromAnnotations(classificationSchemeAnnotations)
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  retrieveAnnotationsForClassificationScheme (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
      tag: 'motivation:slr:codebookDevelopment',
      group: window.abwa.groupSelector.currentGroup.id
    }, (err, codebookAnnotations) => {
      if (err) {
        callback(err)
      } else {
        window.abwa.hypothesisClientManager.hypothesisClient.searchAnnotations({
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
  }
}

module.exports = MappingStudyManager
