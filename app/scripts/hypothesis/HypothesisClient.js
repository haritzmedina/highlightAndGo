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
      callback(response.id)
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
    let url = this.baseURI + '/search'
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
      'headers': headers,
      'data': data
    }
    $.ajax(settings).done((response) => {
      callback(response.rows)
    })
  }
}

module.exports = HypothesisClient
