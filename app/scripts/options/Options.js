const Alerts = require('../utils/Alerts')
const FileUtils = require('../utils/FileUtils')
const LocalStorageManager = require('../storage/local/LocalStorageManager')
const FileSaver = require('file-saver')
const _ = require('lodash')
const Neo4JAuditUrlsConfig = require('./Neo4JAuditUrlsConfig')

class Options {
  init () {
    // Storage type
    document.querySelector('#storageDropdown').addEventListener('change', (event) => {
      // Get value
      if (event.target.selectedOptions && event.target.selectedOptions[0] && event.target.selectedOptions[0].value) {
        this.setStorage(event.target.selectedOptions[0].value)
        // Show/hide configuration for selected storage
        this.showSelectedStorageConfiguration(event.target.selectedOptions[0].value)
      }
    })
    chrome.runtime.sendMessage({scope: 'storage', cmd: 'getSelectedStorage'}, ({storage}) => {
      document.querySelector('#storageDropdown').value = storage || 'hypothesis'
      this.showSelectedStorageConfiguration(storage)
    })
    chrome.runtime.sendMessage({scope: 'googleSheets', cmd: 'getPreferences'}, ({preferences}) => {
      document.querySelector('#allEvidenceSheetCheckbox').checked = preferences.allEvidenceSheet
    })
    document.querySelector('#allEvidenceSheetCheckbox').addEventListener('change', (event) => {
      this.updateSheetPreferences()
    })
    // Local storage restore
    document.querySelector('#restoreDatabaseButton').addEventListener('click', () => {
      Alerts.inputTextAlert({
        title: 'Upload your database backup file',
        html: 'Danger zone! <br/>This operation will override current local storage database, deleting all the annotations for all your documents. Please make a backup first.',
        type: Alerts.alertType.warning,
        input: 'file',
        callback: (err, file) => {
          if (err) {
            window.alert('An unexpected error happened when trying to load the alert.')
          } else {
            // Read json file
            FileUtils.readJSONFile(file, (err, jsonObject) => {
              if (err) {
                Alerts.errorAlert({text: 'Unable to read json file: ' + err.message})
              } else {
                this.restoreDatabase(jsonObject, (err) => {
                  if (err) {
                    Alerts.errorAlert({text: 'Something went wrong when trying to restore the database'})
                  } else {
                    Alerts.successAlert({text: 'Database restored.'})
                  }
                })
              }
            })
          }
        }
      })
    })
    // Local storage backup
    document.querySelector('#backupDatabaseButton').addEventListener('click', () => {
      this.backupDatabase()
    })
    // Local storage delete
    document.querySelector('#deleteDatabaseButton').addEventListener('click', () => {
      Alerts.confirmAlert({
        title: 'Deleting your database',
        alertType: Alerts.alertType.warning,
        text: 'Danger zone! <br/>This operation will override current local storage database, deleting all the annotations for all your documents. Please make a backup first.',
        callback: () => {
          this.deleteDatabase((err) => {
            if (err) {
              Alerts.errorAlert({text: 'Error deleting the database, please try it again or contact developer.'})
            } else {
              Alerts.successAlert({text: 'Local storage successfully deleted'})
            }
          })
        }
      })
    })
    // Hypothesis login
    this.hypothesisConfigurationContainerElement = document.querySelector('#hypothesisConfigurationCard')
    this.hypothesisConfigurationContainerElement.querySelector('#hypothesisLogin').addEventListener('click', this.createHypothesisLoginEventHandler())
    this.hypothesisConfigurationContainerElement.querySelector('#hypothesisLogout').addEventListener('click', this.createHypothesisLogoutEventHandler())
    this.hypothesisConfigurationContainerElement.querySelector('#hypothesisLoggedInUsername').addEventListener('click', this.createDisplayHypothesisLoginInfoEventHandler())
    // Get token and username if logged in
    chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getToken'}, ({ token }) => {
      if (_.isString(token)) {
        this.hypothesisToken = token
        chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getUserProfileMetadata'}, (profile) => {
          this.hypothesisConfigurationContainerElement.querySelector('#hypothesisLoggedInUsername').innerText = profile.metadata.displayName
        })
        this.hypothesisConfigurationContainerElement.querySelector('#hypothesisLoginContainer').setAttribute('aria-hidden', 'true')
      } else {
        this.hypothesisConfigurationContainerElement.querySelector('#hypothesisLoggedInContainer').setAttribute('aria-hidden', 'true')
      }
    })
    // Neo4J Configuration
    this.neo4JEndpointElement = document.querySelector('#neo4jEndpoint')
    this.neo4JTokenElement = document.querySelector('#neo4jToken')
    this.neo4JUserElement = document.querySelector('#neo4jUser')
    this.neo4JEndpointElement.addEventListener('keyup', this.createNeo4JConfigurationSaveEventHandler())
    this.neo4JTokenElement.addEventListener('keyup', this.createNeo4JConfigurationSaveEventHandler())
    this.neo4JUserElement.addEventListener('keyup', this.createNeo4JConfigurationSaveEventHandler())
    // Restore form from credentials saved in storage
    chrome.runtime.sendMessage({scope: 'neo4j', cmd: 'getCredentials'}, ({credentials}) => {
      this.neo4JEndpointElement.value = credentials.endpoint || ''
      this.neo4JTokenElement.value = credentials.token || ''
      this.neo4JUserElement.value = credentials.user || ''
    })
    // Neo4J Audit Urls pane
    chrome.runtime.sendMessage({scope: 'neo4j', cmd: 'getAuditUrlsConfig'}, ({auditUrlsConfig}) => {
      this.neo4JAuditUrlsConfig = new Neo4JAuditUrlsConfig(auditUrlsConfig)
    })
  }

  restoreDatabase (jsonObject, callback) {
    window.options.localStorage = new LocalStorageManager()
    window.options.localStorage.init(() => {
      window.options.localStorage.saveDatabase(jsonObject, callback)
    })
  }

  backupDatabase () {
    window.options.localStorage = new LocalStorageManager()
    window.options.localStorage.init(() => {
      let stringifyObject = JSON.stringify(window.options.localStorage.annotationsDatabase, null, 2)
      // Download the file
      let blob = new window.Blob([stringifyObject], {
        type: 'text/plain;charset=utf-8'
      })
      let dateString = (new Date()).toISOString()
      FileSaver.saveAs(blob, 'reviewAndGo-databaseBackup' + dateString + '.json')
    })
  }

  deleteDatabase (callback) {
    window.options.localStorage = new LocalStorageManager()
    window.options.localStorage.init(() => {
      window.options.localStorage.cleanDatabase(callback)
    })
  }

  setStorage (storage) {
    chrome.runtime.sendMessage({
      scope: 'storage',
      cmd: 'setSelectedStorage',
      data: {storage: storage}
    }, ({storage}) => {
      console.debug('Storage selected ' + storage)
    })
  }

  showSelectedStorageConfiguration (selectedStorage) {
    // Hide all storage configurations
    let storageConfigurationCards = document.querySelectorAll('.storageConfiguration')
    storageConfigurationCards.forEach((storageConfigurationCard) => {
      storageConfigurationCard.setAttribute('aria-hidden', 'true')
    })
    // Show corresponding selected storage configuration card
    let selectedStorageConfigurationCard = document.querySelector('#' + selectedStorage + 'ConfigurationCard')
    if (_.isElement(selectedStorageConfigurationCard)) {
      selectedStorageConfigurationCard.setAttribute('aria-hidden', 'false')
    }
  }

  createNeo4JConfigurationSaveEventHandler () {
    return (e) => {
      this.saveNeo4JConfiguration()
    }
  }

  saveNeo4JConfiguration () {
    // Check validity
    if (this.neo4JEndpointElement.checkValidity() && this.neo4JTokenElement.checkValidity() && this.neo4JUserElement.checkValidity()) {
      let credentials = {
        endpoint: this.neo4JEndpointElement.value,
        token: this.neo4JTokenElement.value,
        user: this.neo4JUserElement.value
      }
      chrome.runtime.sendMessage({
        scope: 'neo4j',
        cmd: 'setCredentials',
        data: {credentials: credentials}
      }, ({credentials}) => {
        console.debug('Saved credentials ' + JSON.stringify(credentials))
      })
    }
  }

  updateSheetPreferences () {
    // Get preferences from form elements
    let preferences = {}
    preferences['allEvidenceSheet'] = document.querySelector('#allEvidenceSheetCheckbox').checked
    // Send preferences to chrome background
    chrome.runtime.sendMessage({
      scope: 'googleSheets',
      cmd: 'setPreferences',
      data: {preferences: preferences}
    }, ({preferences}) => {
      console.debug('Saved credentials ' + JSON.stringify(preferences))
    })
  }

  createHypothesisLoginEventHandler () {
    return () => {
      chrome.runtime.sendMessage({
        scope: 'hypothesis',
        cmd: 'userLoginForm'
      }, ({token}) => {
        this.hypothesisToken = token
        chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getUserProfileMetadata'}, (profile) => {
          document.querySelector('#hypothesisLoggedInUsername').innerText = profile.metadata.displayName
          document.querySelector('#hypothesisLoggedInContainer').setAttribute('aria-hidden', 'false')
        })
        document.querySelector('#hypothesisLoginContainer').setAttribute('aria-hidden', 'true')
      })
    }
  }

  createHypothesisLogoutEventHandler () {
    return () => {
      chrome.runtime.sendMessage({
        scope: 'hypothesis',
        cmd: 'userLogout'
      }, ({token}) => {
        document.querySelector('#hypothesisLoggedInContainer').setAttribute('aria-hidden', 'true')
        document.querySelector('#hypothesisLoginContainer').setAttribute('aria-hidden', 'false')
        this.hypothesisToken = 'Unknown'
        document.querySelector('#hypothesisLoggedInUsername').innerText = 'Unknown user'
      })
    }
  }

  createDisplayHypothesisLoginInfoEventHandler () {
    return () => {
      Alerts.infoAlert({
        title: 'You are logged in Hypothes.is',
        text: 'Token: ' + window.options.hypothesisToken
      })
    }
  }
}

module.exports = Options
