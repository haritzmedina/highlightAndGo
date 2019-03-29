class Evidence {
  constructor ({code = null, annotation = [], user = null, validated = false, validatedAnnotations = []}) {
    this.code = code
    this.annotation = annotation
    this.user = user
    this.validated = validated
    this.validatedAnnotations = validatedAnnotations
  }
}

module.exports = Evidence
