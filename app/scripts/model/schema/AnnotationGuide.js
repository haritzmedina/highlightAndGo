class AnnotationGuide {
  constructor ({name, hypothesisGroup, guideElements = []}) {
    this.name = name.substr(0, 25)
    this.hypothesisGroup = hypothesisGroup
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
