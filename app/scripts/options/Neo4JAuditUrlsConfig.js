class Neo4JAuditUrlsConfig {
  constructor (config) {
    this.lastFrontEnd = config.lastFrontEnd
    this.lastBackEnd = config.lastBackEnd
    this.auditUrls = config.auditUrls || []
  }

  addAuditUrl () {

  }

  deleteAuditUrl () {

  }

  saveToChromeStorage () {

  }
}

module.exports = Neo4JAuditUrlsConfig
