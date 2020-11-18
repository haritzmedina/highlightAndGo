const ChromeStorage = require('../utils/ChromeStorage')

class Neo4JManager {
  init () {
    this.initRespondent()
  }

  initRespondent () {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.scope === 'neo4j') {
        if (request.cmd === 'getCredentials') {
          ChromeStorage.getData('neo4j.credentials', ChromeStorage.sync, (err, credentials) => {
            if (err) {
              sendResponse({err: err})
            } else {
              if (credentials) {
                let parsedCredentials = JSON.parse(credentials.data)
                sendResponse({credentials: parsedCredentials || {}})
              } else {
                sendResponse({credentials: {}})
              }
            }
          })
        } else if (request.cmd === 'setCredentials') {
          let credentials = request.data.credentials
          ChromeStorage.setData('neo4j.credentials', {data: JSON.stringify(credentials)}, ChromeStorage.sync, (err) => {
            if (err) {
              sendResponse({err: err})
            } else {
              sendResponse({credentials: credentials})
            }
          })
        } else if (request.cmd === 'setAuditUrlsConfig') {
          let auditUrlsConfig = request.data.auditUrlsConfig
          ChromeStorage.setData('neo4j.auditUrlsConfig', {data: JSON.stringify(auditUrlsConfig)}, ChromeStorage.sync, (err) => {
            if (err) {
              sendResponse({err: err})
            } else {
              sendResponse({auditUrlsConfig: auditUrlsConfig})
            }
          })
        } else if (request.cmd === 'getAuditUrlsConfig') {
          ChromeStorage.getData('neo4j.auditUrlsConfig', ChromeStorage.sync, (err, auditUrlsConfig) => {
            if (err) {
              sendResponse({err: err})
            } else {
              if (auditUrlsConfig) {
                let parsedAuditUrlsConfig = JSON.parse(auditUrlsConfig.data)
                sendResponse({auditUrlsConfig: parsedAuditUrlsConfig || {}})
              } else {
                sendResponse({auditUrlsConfig: {}})
              }
            }
          })
        }
      }
    })
  }
}

module.exports = Neo4JManager
