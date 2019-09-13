const _ = require('lodash')

/**
 * StorageManager is an interface that declares which are the required functions by any Storage Manager (a.k.a: storage driver manager).
 * An storage manager is a singleton that creates, holds and removes safely the storage client which is the mediator between the annotations storage and the application.
 */
class StorageManager {
  constructor () {
    /**
     * The client is the mediator between storage and web annotator. It has methods for manipulating the database where annotations are stored (annotation creation, search, delete, update,...) but also for group (create, leave,...) and user management (get user profile)
     * @type {{}}
     */
    this.client = {}
    /**
     * The storage holds metadata about the storage, such as its base URL, endpoint, annotations url, groups url,...
     * @type {{annotationUrl: string, storageUrl: string}}
     */
    this.storageMetadata = {
      annotationUrl: 'https://localannotationsdatabase.org/annotation/',
      groupUrl: 'https://localannotationsdatabase.org/group/',
      userUrl: 'https://localannotationsdatabase.org/user/',
      storageUrl: 'https://localannotationsdatabase.org'
    }
  }

  /**
   * Returns if the user is logged in the storage and guarantees that the credentials for further interaction with the storage is correct
   * @param callback Returns 2 parameters to the callback function, first if an error happened while checking if the user is logged in, second if it is logged in or not
   */
  isLoggedIn (callback) {
    if (_.isFunction(callback)) {
      callback(null, true)
    }
  }

  /**
   * It is a method to prompt the user with the form/website/... to log in the storage
   * @param callback
   */
  logIn (callback) {
    if (_.isFunction(callback)) {
      callback(null)
    }
  }

  /**
   * It is a method to reload the storage client (deconstruct and construct again)
   * @param callback
   */
  reloadClient (callback) {
    if (_.isFunction(callback)) {
      callback(null)
    }
  }

  /**
   * Method to retrieve storage metadata
   * @return {{annotationUrl: string, storageUrl: string}}
   */
  getStorageMetadata () {
    return this.storageMetadata
  }

  /**
   * It is a method to remove the client from memory but also event listeners, intervals,... required to manage the storage used.
   * @param callback
   */
  destroy (callback) {
    if (_.isFunction(callback)) {
      callback(null)
    }
  }
}

module.exports = StorageManager
