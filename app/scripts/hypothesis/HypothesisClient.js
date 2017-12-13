const _ = require('lodash')

const MAX_NUMBER_OF_ANNOTATIONS_TO_SEARCH = 5000

let $
if (typeof window === 'undefined') {
  $ = require('jquery')(global.window)
} else {
  $ = require('jquery')
}

class HypothesisClient {
  constructor (token) {
    if (token) {
      this.token = token
    }
    this.baseURI = 'https://hypothes.is/api'
  }

  createNewAnnotation (data, callback) {
    let url = this.baseURI + '/annotations'
    let settings = {
      'async': true,
      'crossDomain': true,
      'url': url,
      'method': 'POST',
      'headers': {
        'authorization': 'Bearer ' + this.token,
        'content-type': 'application/json',
        'cache-control': 'no-cache'
      },
      processData: false,
      data: JSON.stringify(data)
    }

    $.ajax(settings).done((response) => {
      callback(response)
    })
  }

  getUserProfile (callback) {
    let url = this.baseURI + '/profile'
    let settings = {
      'async': true,
      'crossDomain': true,
      'url': url,
      'method': 'GET',
      'headers': {
        'authorization': 'Bearer ' + this.token,
        'cache-control': 'no-cache'
      }
    }
    $.ajax(settings).done((response) => {
      callback(response)
    })
  }

  fetchAnnotation (id, callback) {
    let url = this.baseURI + '/annotations/' + id
    let headers = {
      'cache-control': 'no-cache'
    }
    if (this.token) {
      headers['authorization'] = 'Bearer ' + this.token
    }
    let settings = {
      'async': true,
      'crossDomain': true,
      'url': url,
      'method': 'GET',
      'headers': headers
    }
    $.ajax(settings).done((response) => {
      callback(response)
    })
  }

  updateAnnotation (id, data, callback) {
    let url = this.baseURI + '/annotations/' + id
    let settings = {
      'async': true,
      'crossDomain': true,
      'url': url,
      'method': 'PATCH',
      'headers': {
        'authorization': 'Bearer ' + this.token,
        'cache-control': 'no-cache'
      },
      'data': data
    }
    $.ajax(settings).done((response) => {
      callback(response)
    })
  }

  deleteAnnotation (id, callback) {
    let url = this.baseURI + '/annotations/' + id
    let settings = {
      'async': true,
      'crossDomain': true,
      'url': url,
      'method': 'DELETE',
      'headers': {
        'authorization': 'Bearer ' + this.token,
        'cache-control': 'no-cache'
      }
    }
    $.ajax(settings).done((response) => {
      callback(response)
    })
  }

  searchAnnotations (data, callback) {
    let annotations = []
    this.searchBunchAnnotations(data, 0, (err, response) => {
      if (err) {
        if (_.isFunction(callback)) {
          callback(annotations)
        }
      } else {
        // Concat first time done annotations
        annotations = annotations.concat(response.rows)
        // Set maximum of queries
        let total = data.limit || response.total
        if (total > MAX_NUMBER_OF_ANNOTATIONS_TO_SEARCH) {
          total = MAX_NUMBER_OF_ANNOTATIONS_TO_SEARCH // Limit the number of results
        }
        // Retrieve the rest of annotations
        let promises = []
        for (let i = annotations.length; i < total; i += 200) {
          let iterationData = Object.assign({}, data)
          if (total < i + 200) {
            iterationData.limit = total % 200
          } else {
            iterationData.limit = 200
          }
          // Create a promise for each request to do
          promises.push(new Promise((resolve) => {
            this.searchBunchAnnotations(iterationData, i, (err, response) => {
              if (err) {
                resolve() // TODO Manage error
              } else {
                annotations = annotations.concat(response.rows)
                resolve()
              }
            })
          }))
        }
        // Execute all the promises
        Promise.all(promises).then(() => {
          console.log(annotations)
          if (_.isFunction(callback)) {
            callback(annotations)
          }
        })
      }
    })
  }

  searchBunchAnnotations (data, offset, callback) {
    let url = this.baseURI + '/search'
    let headers = {
      'cache-control': 'no-cache'
    }
    if (this.token) {
      headers['authorization'] = 'Bearer ' + this.token
    }
    if (!_.isNumber(data.limit)) {
      data.limit = 200 // TODO
    }
    data.offset = offset
    let settings = {
      'async': true,
      'crossDomain': true,
      'url': url,
      'method': 'GET',
      'headers': headers,
      'data': data,
      'retryCount': 0,
      'retryLimit': 5,
      'created': Date.now(),
      'success': (response) => {
        if (_.isFunction(callback)) {
          callback(null, response)
        }
      },
      'error': function () {
        this.retryCount++
        if (this.retryCount <= this.retryLimit) {
          console.log('Retrying for ' + offset)
          $.ajax(this)
        } else {
          console.log('No more retries for ' + offset)
          if (_.isFunction(callback)) {
            callback(new Error(), [])
          }
        }
      }
    }
    $.ajax(settings)
  }
}

module.exports = HypothesisClient
