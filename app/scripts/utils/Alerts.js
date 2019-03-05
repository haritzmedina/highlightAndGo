const _ = require('lodash')

let swal = null
if (document && document.head) {
  swal = require('sweetalert2')
}

class Alerts {
  static confirmAlert ({alertType = Alerts.alertType.info, title = '', text = '', callback, cancelCallback}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      let fire = () => {
        swal.fire({
          title: title,
          html: text,
          type: alertType,
          showCancelButton: true
        }).then((result) => {
          if (result.value) {
            if (_.isFunction(callback)) {
              callback(null, result.value)
            }
          } else if (result.dismiss) {
            if (_.isFunction(cancelCallback)) {
              cancelCallback(null)
            }
          }
        })
      }
      if (Alerts.isVisible()) {
        Alerts.closeAlert()
        setTimeout(fire, 1000)
      } else {
        fire()
      }
    }
  }

  static infoAlert ({text = chrome.i18n.getMessage('expectedInfoMessageNotFound'), title = 'Info', timerIntervalHandler, timerIntervalPeriodInSeconds = 0.1, callback}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      let fire = () => {
        let timerInterval
        swal.fire({
          type: Alerts.alertType.info,
          title: title,
          html: text,
          showConfirmButton: true,
          onOpen: () => {
            if (_.isFunction(timerIntervalHandler)) {
              timerInterval = setInterval(() => {
                timerIntervalHandler(swal)
              }, timerIntervalPeriodInSeconds * 1000)
            }
          },
          onClose: () => {
            clearInterval(timerInterval)
          }
        })
      }
      if (Alerts.isVisible()) {
        Alerts.closeAlert()
        setTimeout(fire, 1000)
      } else {
        fire()
      }
    }
  }

  static errorAlert ({text = chrome.i18n.getMessage('unexpectedError'), title = 'Oops...', callback, onClose}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      let fire = () => {
        swal.fire({
          type: Alerts.alertType.error,
          title: title,
          html: text,
          onClose: onClose
        }).then(() => {
          if (_.isFunction(callback)) {
            callback(null)
          }
        })
      }
      if (Alerts.isVisible()) {
        Alerts.closeAlert()
        setTimeout(fire, 1000)
      } else {
        fire()
      }
    }
  }

  static successAlert ({text = 'Your process is correctly done', title = 'Great!', callback}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      let fire = () => {
        swal.fire({
          type: Alerts.alertType.success,
          title: title,
          html: text
        })
      }
      if (Alerts.isVisible()) {
        Alerts.closeAlert()
        setTimeout(fire, 1000)
      } else {
        fire()
      }
    }
  }

  static temporalAlert ({text = 'It is done', title = 'Finished', type = Alerts.alertType.info, timer = 1500, position = 'top-end', toast = false, callback}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      let fire = () => {
        swal.fire({
          position: position,
          type: type,
          title: title,
          html: text,
          showConfirmButton: false,
          timer: timer,
          toast: toast
        })
      }
      if (Alerts.isVisible()) {
        Alerts.closeAlert()
        setTimeout(fire, 1000)
      } else {
        fire()
      }
    }
  }

  static loadingAlert ({
    text = 'If it takes too much time, please reload the page and try again.',
    position = 'top-end',
    title = 'Working on something, please be patient',
    confirmButton = false,
    timerIntervalHandler,
    timerIntervalPeriodInSeconds = 0.1,
    callback
  }) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      let fire = () => {
        let timerInterval
        swal.fire({
          position: position,
          title: title,
          html: text,
          showConfirmButton: confirmButton,
          onOpen: () => {
            swal.showLoading()
            if (_.isFunction(timerIntervalHandler)) {
              timerInterval = setInterval(() => {
                timerIntervalHandler(swal)
              }, timerIntervalPeriodInSeconds * 1000)
            }
          },
          onClose: () => {
            clearInterval(timerInterval)
          }
        })
      }
      if (Alerts.isVisible()) {
        Alerts.closeAlert()
        setTimeout(fire, 1000)
      } else {
        fire()
      }
    }
  }

  static inputTextAlert ({input = 'text', inputPlaceholder = '', inputValue = '', inputAttributes = {}, onOpen, onBeforeOpen, position = Alerts.position.center, showCancelButton = true, html = '', callback}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      let fire = () => {
        swal.fire({
          input: input,
          inputPlaceholder: inputPlaceholder,
          inputValue: inputValue,
          inputAttributes: inputAttributes,
          html: html,
          onOpen: onOpen,
          onBeforeOpen: onBeforeOpen,
          showCancelButton: showCancelButton
        }).then((result) => {
          if (result.value) {
            if (_.isFunction(callback)) {
              callback(null, result.value)
            }
          }
        })
      }
      if (Alerts.isVisible()) {
        Alerts.closeAlert()
        setTimeout(fire, 1000)
      } else {
        fire()
      }
    }
  }

  static multipleInputAlert ({title = 'Input', html = '', preConfirm, onOpen, onBeforeOpen, position = Alerts.position.center, showCancelButton = true, callback}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      let fire = () => {
        swal.fire({
          title: title,
          html: html,
          focusConfirm: false,
          preConfirm: preConfirm,
          position: position,
          onOpen: onOpen,
          onBeforeOpen: onBeforeOpen,
          showCancelButton: showCancelButton
        }).then(() => {
          if (_.isFunction(callback)) {
            callback(null)
          }
        })
      }
      if (Alerts.isVisible()) {
        Alerts.closeAlert()
        setTimeout(fire, 1000)
      } else {
        fire()
      }
    }
  }

  static tryToLoadSwal () {
    if (_.isNull(swal)) {
      try {
        swal = require('sweetalert2')
      } catch (e) {
        swal = null
      }
    }
  }

  static warningAlert ({text = 'Something that you need to worry about happened. ' + chrome.i18n.getMessage('ContactAdministrator'), title = 'Warning', callback}) {
    Alerts.tryToLoadSwal()
    if (_.isNull(swal)) {
      if (_.isFunction(callback)) {
        callback(new Error('Unable to load swal'))
      }
    } else {
      let fire = () => {
        Alerts.closeAlert()
        swal.fire({
          type: Alerts.alertType.warning,
          title: title,
          html: text
        })
      }
      if (Alerts.isVisible()) {
        Alerts.closeAlert()
        setTimeout(fire, 1000)
      } else {
        fire()
      }
    }
  }

  static closeAlert () {
    if (Alerts.isVisible()) {
      swal.close()
    }
  }

  static isVisible () {
    return swal.isVisible()
  }
}

Alerts.alertType = {
  warning: 'warning',
  error: 'error',
  success: 'success',
  info: 'info',
  question: 'question'
}

Alerts.position = {
  top: 'top',
  topStart: 'top-start',
  topEnd: 'top-end',
  center: 'center',
  centerStart: 'center-start',
  centerEnd: 'center-end',
  bottom: 'bottom',
  bottomStart: 'bottom-start',
  bottomEnd: 'bottom-end'
}

module.exports = Alerts
