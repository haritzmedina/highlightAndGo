const $ = require('jquery')
const _ = require('lodash')
const Events = require('./Events')
const LanguageUtils = require('../utils/LanguageUtils')

class UserFilter {
  constructor () {
    this.filteredUsers = null
    this.allUsers = []
    this.events = {}
    this.userFilterWrapper = null
    this.usersContainer = null
  }

  init (callback) {
    this.initUserFilterStructure((err) => {
      if (err) {
        // Handle error
        if (_.isFunction(callback)) {
          callback(err)
        }
      } else {
        // Annotations updated event handler
        this.initAnnotationsUpdatedEventHandler()
        // Init event handler when click in all
        this.initAllFilter()
        // Init panel construction (if no annotation event is detected)
        this.initUsersPanel()
        // Callback
        if (_.isFunction(callback)) {
          callback()
        }
      }
    })
  }

  initUserFilterStructure (callback) {
    let tagWrapperUrl = chrome.extension.getURL('pages/sidebar/userFilterWrapper.html')
    $.get(tagWrapperUrl, (html) => {
      document.querySelector('#codingValidationContainer').insertAdjacentHTML('afterbegin', html)
      this.userFilterWrapper = document.querySelector('#userFilterWrapper')
      this.usersContainer = document.querySelector('#usersContainer')
      if (_.isFunction(callback)) {
        callback()
      }
    })
  }

  initAllFilter () {
    let allFilter = document.querySelector('#userFilter_all')
    allFilter.checked = true
    // Init event handler on change all filter
    allFilter.addEventListener('change', (event) => {
      if (event.target.checked) {
        this.activateAll()
      } else {
        this.deactivateAll()
      }
      // Dispatch event user filter has changed
      this.dispatchFilterChanged()
    })
    let initialEventListener = () => {
      this.activateAll()
      document.removeEventListener(Events.updatedAllAnnotations, initialEventListener)
    }
    document.addEventListener(Events.updatedAllAnnotations, initialEventListener)
  }

  activateAll () {
    let checkboxes = this.usersContainer.querySelectorAll('input')
    this.filteredUsers = _.clone(this.allUsers)
    // Activate all the checkboxes
    checkboxes.forEach((checkbox) => {
      checkbox.checked = true
      $(checkbox).attr('checked', 'true')
    })
  }

  deactivateAll () {
    let checkboxes = this.usersContainer.querySelectorAll('input')
    this.filteredUsers = []
    // Deactivate all the checkboxes
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false
      $(checkbox).removeAttr('checked')
    })
  }

  initAnnotationsUpdatedEventHandler (callback) {
    this.events.updatedAllAnnotations = {element: document, event: Events.updatedAllAnnotations, handler: this.createUpdatedAllAnnotationsEventHandler()}
    this.events.updatedAllAnnotations.element.addEventListener(this.events.updatedAllAnnotations.event, this.events.updatedAllAnnotations.handler, false)
    if (_.isFunction(callback)) {
      callback()
    }
  }

  createUpdatedAllAnnotationsEventHandler () {
    return (event) => {
      // Retrieve all annotations
      let annotations = []
      if (_.has(event, 'detail.annotations')) {
        annotations = event.detail.annotations // If is included in the event
      } else {
        annotations = window.abwa.contentAnnotator.allAnnotations
      }
      annotations = _.filter(annotations, (annotation) => {
        return annotation.motivation === 'classifying' || annotation.motivation === 'oa:classifying'
      })
      this.updateUsersPanel(annotations)
    }
  }

  initUsersPanel () {
    let annotations = []
    if (window.abwa.contentAnnotator) {
      annotations = window.abwa.contentAnnotator.allAnnotations || []
    }
    // Retrieve only annotations for motivation classifying
    let classifyingAnnotations = _.filter(annotations, (annotation) => {
      return annotation.motivation === 'classifying' || annotation.motivation === 'oa:classifying'
    })
    if (_.isArray(classifyingAnnotations)) {
      // Retrieve users who had annotated the document
      this.allUsers = _.uniq(_.map(classifyingAnnotations, (annotation) => {
        return annotation.user
      }))
      this.filteredUsers = _.clone(this.allUsers)
      // Upload sidebar panel with users
      this.usersContainer.innerHTML = '' // Empty the container
      for (let i = 0; i < this.allUsers.length; i++) {
        $(this.usersContainer).append(this.createUserFilterElement(this.allUsers[i]))
      }
      // Activate all users
      let checkboxes = this.usersContainer.querySelectorAll('input')
      for (let i = 0; i < checkboxes.length; i++) {
        let currentCheckbox = checkboxes[i]
        currentCheckbox.checked = true
      }
      // If all old filtered users are current all users, just activate all of them
      this.checkAllActivated()
    }
  }

  updateUsersPanel (annotations) {
    if (_.isArray(annotations)) {
      let oldFilteredUsers = _.clone(this.filteredUsers)
      // Retrieve users who had annotated the document
      this.allUsers = _.uniq(_.map(annotations, (annotation) => {
        return annotation.user
      }))
      this.filteredUsers = _.clone(this.allUsers)
      // Upload sidebar panel with users
      this.usersContainer.innerHTML = '' // Empty the container
      for (let i = 0; i < this.allUsers.length; i++) {
        $(this.usersContainer).append(this.createUserFilterElement(this.allUsers[i]))
      }
      // Activate users which where previously activated (and remove if no user is found from this.allUsers and this.filteredUsers)
      let checkboxes = this.usersContainer.querySelectorAll('input')
      for (let i = 0; i < checkboxes.length; i++) {
        let currentCheckbox = checkboxes[i]
        if (_.isString(_.find(oldFilteredUsers, (oldUser) => {
          return oldUser === currentCheckbox.id.replace('userFilter_', '')
        }))) {
          currentCheckbox.checked = true
        }
      }
      // If all old filtered users are current all users, just activate all of them
      this.checkAllActivated()
    }
  }

  createUserFilterElement (name) {
    let normalizedName = LanguageUtils.normalizeStringToValidID(name)
    let userFilterTemplate = document.querySelector('#userFilterTemplate')
    let userFilterElement = $(userFilterTemplate.content.firstElementChild).clone().get(0)
    // Set text and properties for label and input
    let input = userFilterElement.querySelector('input')
    input.id = 'userFilter_' + normalizedName
    let label = userFilterElement.querySelector('label')
    label.innerText = name.replace('acct:', '').replace('@hypothes.is', '') // Remove to user name hypothesis
    label.htmlFor = 'userFilter_' + normalizedName
    // Set event handler for input check status
    input.addEventListener('change', (event) => {
      // Update filtered array
      if (event.target.checked) {
        // Add to filtered elements
        if (!_.includes(this.filteredUsers, normalizedName)) {
          this.filteredUsers.push(normalizedName)
        }
        // Activate all filter if all users are selected
        this.checkAllActivated()
      } else {
        // Remove from filtered elements
        _.pull(this.filteredUsers, normalizedName)
        // Deactivate all filter
        document.querySelector('#userFilter_all').checked = false
      }
      // Dispatch filter changed
      this.dispatchFilterChanged()
    })
    return userFilterElement
  }

  checkAllActivated () {
    let allCheckboxes = this.usersContainer.querySelectorAll('input')
    let deactivatedCheckboxes = _.find(allCheckboxes, (checkbox) => { return checkbox.checked === false })
    if (_.isUndefined(deactivatedCheckboxes)) { // There are not found any deactivated checkboxes
      document.querySelector('#userFilter_all').checked = true
    }
  }

  dispatchFilterChanged () {
    LanguageUtils.dispatchCustomEvent(Events.userFilterChange, {filteredUsers: this.filteredUsers})
  }

  destroy () {
    // Remove event listeners
    let events = _.values(this.events)
    for (let i = 0; i < events.length; i++) {
      events[i].element.removeEventListener(events[i].event, events[i].handler)
    }
    // Remove user filter container from sidebar
    $(this.userFilterWrapper).remove()
  }
}

module.exports = UserFilter
