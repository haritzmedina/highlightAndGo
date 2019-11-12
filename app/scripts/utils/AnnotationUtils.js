const _ = require('lodash')

class AnnotationUtils {
  static getTagFromAnnotation (annotation, prefix) {
    return _.find(annotation.tags, (tag) => {
      return tag.startsWith(prefix)
    })
  }

  static getTagSubstringFromAnnotation (annotation, prefix) {
    let tag = AnnotationUtils.getTagFromAnnotation(annotation, prefix)
    if (tag) {
      return tag.replace(prefix, '')
    } else {
      return null
    }
  }

  static isReplyOf (formerAnnotation, replyAnnotation) {
    if (_.has(replyAnnotation, 'references')) {
      return !!_.find(replyAnnotation.references, (ref) => { return ref === formerAnnotation.id })
    } else {
      return false
    }
  }

  static areEqual (anno1, anno2) {
    return _.isEqual(anno1.tags, anno2.tags) && anno1.text === anno2.text
  }

  static areFromSameDocument (a, b) {
    // By url
    if (a.uri && b.uri) {
      if (a.uri === b.uri) {
        return true
      }
    }
    // By target source
    if (_.isArray(a.target) && _.isArray(b.target)) {
      let intersection = _.intersectionWith(a.target, b.target, (atarget, btarget) => {
        if (atarget.source && btarget.source) {
          if (atarget.source.id && atarget.source.id === btarget.source.id) {
            return true
          }
          if (atarget.source.doi && atarget.source.doi === btarget.source.doi) {
            return true
          }
          if (atarget.source.url && atarget.source.url === btarget.source.url) {
            return true
          }
          if (atarget.source.urn && atarget.source.urn === btarget.source.urn) {
            return true
          }
          return false
        }
      })
      if (!_.isEmpty(intersection)) {
        return true
      }
    }
    // By documentmetadata
    if (a.documentMetadata && a.documentMetadata.documentFingerprint && b.documentMetadata && b.documentMetadata.documentFingerprint) {
      // TODO Use also DOI to identify that they are the same document
      let result = a.documentMetadata.documentFingerprint === b.documentMetadata.documentFingerprint
      if (result) {
        return result
      }
    }
    return false
  }
}

module.exports = AnnotationUtils
