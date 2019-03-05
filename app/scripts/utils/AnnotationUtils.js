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
}

module.exports = AnnotationUtils
