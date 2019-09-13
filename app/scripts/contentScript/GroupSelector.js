const ChromeStorage = require('../utils/ChromeStorage')
const LanguageUtils = require('../utils/LanguageUtils')
const Alerts = require('../utils/Alerts')
const Events = require('./Events')
const _ = require('lodash')
const $ = require('jquery')

const selectedGroupNamespace = 'storage.currentGroup'

class GroupSelector {
  constructor () {
    this.currentGroup = null
    this.user = {}
  }

  init (callback) {
    console.debug('Initializing group selector')
    this.addGroupSelectorToSidebar(() => {
      this.reloadGroupsContainer((err) => {
        if (err) {
          if (_.isFunction(callback)) {
            callback(err)
          }
        } else {
          if (_.isFunction(callback)) {
            callback()
          }
        }
      })
      this.getUserProfileMetadata()
    })
  }

  addGroupSelectorToSidebar (callback) {
    let sidebarURL = chrome.extension.getURL('pages/sidebar/groupSelection.html')
    $.get(sidebarURL, (html) => {
      // Append sidebar to content
      $('#abwaSidebarContainer').append($.parseHTML(html))
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  /**
   * If not current group set, load from chrome storage last session
   * @param callback
   */
  defineCurrentGroup (callback) {
    // If initialization annotation is set
    if (window.abwa.annotationBasedInitializer.initAnnotation) {
      let annotationGroupId = window.abwa.annotationBasedInitializer.initAnnotation.group
      // Load group of annotation
      this.retrieveGroups((err, groups) => {
        if (err) {
          if (_.isFunction(callback)) {
            callback(err)
          }
        } else {
          // Set current group
          this.currentGroup = _.find(groups, (group) => { return group.id === annotationGroupId })
          // Save to chrome storage current group
          ChromeStorage.setData(selectedGroupNamespace, {data: JSON.stringify(this.currentGroup)}, ChromeStorage.local)
          if (_.isFunction(callback)) {
            callback()
          }
        }
      })
    } else { // If initialization annotation is not set
      this.retrieveGroups((err) => {
        if (err) {
          callback(err)
        } else {
          // Retrieve last saved group
          ChromeStorage.getData(selectedGroupNamespace, ChromeStorage.local, (err, savedCurrentGroup) => {
            if (err) {
              if (_.isFunction(callback)) {
                callback(new Error('Unable to retrieve current selected group'))
              }
            } else {
              let storedGroup
              // Parse retrieved data from chrome storage
              if (!_.isEmpty(savedCurrentGroup) && savedCurrentGroup.data) {
                // Check if stored group exists in groups
                let parsedGroup = JSON.parse(savedCurrentGroup.data)
                storedGroup = _.find(this.user.groups, (group) => {
                  return group.id === parsedGroup.id
                })
              }
              // Check if stored group is a valid group
              if (storedGroup) {
                this.currentGroup = storedGroup
                if (_.isFunction(callback)) {
                  callback()
                }
              } else {
                if (_.isEmpty(this.user.groups)) {
                  if (_.isFunction(callback)) {
                    callback(new Error('No groups created, create one'))
                  }
                } else {
                  this.currentGroup = _.first(this.user.groups)
                  if (_.isFunction(callback)) {
                    callback()
                  }
                }
              }
            }
          })
        }
      })
    }
  }

  reloadGroupsContainer (callback) {
    // Set current group if not defined
    this.defineCurrentGroup((err) => {
      if (err) {
        callback(err)
      } else {
        // Render groups container
        this.renderGroupsContainer(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      }
    })
  }

  renderGroupsContainer (callback) {
    // Display group selector and purposes selector
    $('#purposesWrapper').attr('aria-hidden', 'false')
    // Retrieve groups
    let dropdownMenu = document.querySelector('#groupSelector')
    dropdownMenu.innerHTML = '' // Remove all groups
    this.user.groups.forEach(group => {
      let groupSelectorItem = document.createElement('option')
      groupSelectorItem.dataset.groupId = group.id
      groupSelectorItem.innerText = group.name
      groupSelectorItem.className = 'dropdown-item'
      dropdownMenu.appendChild(groupSelectorItem)
    })
    // Set select option
    $('#groupSelector').find('option[data-group-id="' + this.currentGroup.id + '"]').prop('selected', 'selected')
    // Set event handler for group change
    this.setEventForGroupSelectChange()
    if (_.isFunction(callback)) {
      callback()
    }
  }

  retrieveGroups (callback) {
    window.abwa.storageManager.client.getUserProfile((err, profile) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        this.user = profile
        if (_.isFunction(callback)) {
          callback(null, profile.groups)
        }
      }
    })
  }

  setCurrentGroup (groupId, callback) {
    this.retrieveGroups((err) => {
      if (err) {
        Alerts.errorAlert({text: 'Unable to retrieve list of groups.'})
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Set current group
        let newCurrentGroup = _.find(this.user.groups, (group) => { return group.id === groupId })
        if (newCurrentGroup) {
          this.currentGroup = newCurrentGroup
        }
        this.renderGroupsContainer((err) => {
          if (err) {
            if (_.isFunction(callback)) {
              callback(err)
            }
          } else {
            // Update group selector
            $('#groupSelector').find('option[data-group-id="' + this.currentGroup.id + '"]').prop('selected', 'selected')
            // Event group changed
            this.updateCurrentGroupHandler(this.currentGroup.id)
            // Open sidebar
            window.abwa.sidebar.openSidebar()
            if (_.isFunction(callback)) {
              callback()
            }
          }
        })
      }
    })
  }

  setEventForGroupSelectChange () {
    let menu = document.querySelector('#groupSelector')
    $(menu).change(() => {
      let selectedGroup = $('#groupSelector').find('option:selected').get(0)
      this.updateCurrentGroupHandler(selectedGroup.dataset.groupId)
    })
  }

  updateCurrentGroupHandler (groupId) {
    this.currentGroup = _.find(this.user.groups, (group) => { return groupId === group.id })
    ChromeStorage.setData(selectedGroupNamespace, {data: JSON.stringify(this.currentGroup)}, ChromeStorage.local, () => {
      console.debug('Group updated. Name: %s id: %s', this.currentGroup.name, this.currentGroup.id)
      // Dispatch event
      LanguageUtils.dispatchCustomEvent(Events.groupChanged, {
        group: this.currentGroup,
        time: new Date()
      })
    })
  }

  destroy (callback) {
    if (_.isFunction(callback)) {
      callback()
    }
  }

  getUserProfileMetadata () {
    chrome.runtime.sendMessage({scope: 'hypothesis', cmd: 'getUserProfileMetadata'}, (response) => {
      this.user.metadata = response.metadata
    })
  }

  getCreatorData () {
    if (this.user) {
      if (this.user.metadata) {
        if (this.user.metadata.orcid) {
          return 'https://orcid.org/' + this.user.metadata.orcid
        } else if (this.user.metadata.link) {
          return this.user.metadata.link
        } else {
          return window.abwa.storageManager.storageMetadata.userUrl + this.user.userid.replace('acct:', '').replace('@hypothes.is', '')
        }
      } else {
        return window.abwa.storageManager.storageMetadata.userUrl + this.user.userid.replace('acct:', '').replace('@hypothes.is', '')
      }
    } else {
      return null
    }
  }
}

module.exports = GroupSelector
