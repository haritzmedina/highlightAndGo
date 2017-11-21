const ChromeStorage = require('../utils/ChromeStorage')
const _ = require('lodash')
const $ = require('jquery')

const selectedGroupNamespace = 'hypothesis.currentGroup'
const defaultGroup = {id: '__world__', name: 'Public', public: true}

class GroupSelector {
  constructor () {
    this.currentGroup = null
    this.user = {}
  }

  init (callback) {
    console.debug('Initializing group selector')
    this.addGroupSelectorToSidebar(() => {
      this.reloadGroupsContainer(() => {
        if (_.isFunction(callback)) {
          callback()
        }
      })
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
    if (!this.currentGroup) {
      ChromeStorage.getData(selectedGroupNamespace, ChromeStorage.local, (err, savedCurrentGroup) => {
        if (err) {
          throw new Error('Unable to retrieve current selected group')
        } else {
          // Parse chrome storage result
          if (!_.isEmpty(savedCurrentGroup) && savedCurrentGroup.data) {
            this.currentGroup = JSON.parse(savedCurrentGroup.data)
          } else {
            this.currentGroup = defaultGroup
          }
        }
        if (_.isFunction(callback)) {
          callback()
        }
      })
    } else {
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }

  reloadGroupsContainer (callback) {
    if (window.abwa.hypothesisClientManager.isLoggedIn()) {
      // Hide login/sign up form
      $('#notLoggedInGroupContainer').attr('aria-hidden', 'true')
      // Display group container
      $('#loggedInGroupContainer').attr('aria-hidden', 'false')
      // Set current group if not defined
      this.defineCurrentGroup(() => {
        // Render groups container
        this.renderGroupsContainer(() => {
          if (_.isFunction(callback)) {
            callback()
          }
        })
      })
    } else {
      // Display login/sign up form
      $('#notLoggedInGroupContainer').attr('aria-hidden', 'false')
      // Hide group container
      $('#loggedInGroupContainer').attr('aria-hidden', 'true')
      // Hide purposes wrapper
      $('#purposesWrapper').attr('aria-hidden', 'true')
      if (_.isFunction(callback)) {
        callback()
      }
    }
  }

  renderGroupsContainer (callback) {
    // Display group selector and purposes selector
    $('#purposesWrapper').attr('aria-hidden', 'false')
    // Retrieve groups
    this.retrieveHypothesisGroups((groups) => {
      this.user.groups = groups
      console.debug(groups)
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
    })
  }

  retrieveHypothesisGroups (callback) {
    window.abwa.hypothesisClientManager.hypothesisClient.getUserProfile((profile) => {
      this.user.groups = profile.groups
      if (_.isFunction(callback)) {
        callback(profile.groups)
      }
    })
  }

  setEventForGroupSelectChange () {
    let menu = document.querySelector('#groupSelector')
    $(menu).change(() => {
      let selectedGroup = $('#groupSelector').find('option:selected').get(0)
      this.updateCurrentGroup(selectedGroup.dataset.groupId)
    })
  }
}

module.exports = GroupSelector
