class AnnotationGuide {
  constructor ({name, storage, guideElements = []}) {
    this.name = name.substr(0, 25)
    this.storage = storage
    this.guideElements = guideElements
  }

  toAnnotations () {

  }

  toAnnotation () {

  }

  static fromAnnotation (annotation) {

  }

  static fromAnnotations (annotations) {

  }
}

module.exports = AnnotationGuide
