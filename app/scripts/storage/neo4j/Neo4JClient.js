const _ = require('lodash')
const axios = require('axios')
const jsonld = require('jsonld')

// Configuration constants
const now = new Date()

/// /UTILS
/*
function infinitumReplacement (txt, find, replacement) {
  let resptxt = txt.replace(find, replacement)
  while (resptxt.equals(txt) === false) {
    txt = resptxt
    resptxt = txt.replace(find, replacement)
  }
  return resptxt
} */

function randomString (length = 17, charSet) {
  charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
  let randomString = ''
  for (let i = 0; i < length; i++) {
    let randomPoz = Math.floor(Math.random() * charSet.length)
    randomString += charSet.substring(randomPoz, randomPoz + 1)
  }
  return randomString + now.getMilliseconds()
}

function escapify (myJSON) {
  var myJSONString = JSON.stringify(myJSON)
  var myEscapedJSONString = myJSONString.replace(/'/g, "\\'").replace(/"/g, '\\"')
    .replace(/&/g, '\\&')
  // myEscapedJSONString is now ready to be POST'ed to the server.
  return myEscapedJSONString
}

/// ///

/**
 * Neo4J client class
 */
class Neo4JClient {
  /**
   * Create a Neo4J client
    * @param userName The user name for annotations
    * @param userToken The base64(user+password) to access the Neo4J API
  * @param baseURI The base URI of the Neo4J server. For example,  http:// localhost:7474
   */
  // UserToken iker  aWtlcjppa2Vy
  // AppToken neo4j  bmVvNGo6cGFzc3dvcmQ=
  constructor (userName, userToken, baseURI) {
    this.userName = 'defaultUser'
    this.userToken = 'aWtlcjppa2Vy'
    this.baseURI = 'http://localhost:7474'
    this.baseN4J = 'http://neo4j.com/base/'
    if (userName) {
      this.userName = userName //  btoa(user+":"+password)  // IKER: base64-encoded string of username:password.
    }
    if (userToken) {
      this.userToken = userToken //  btoa(user+":"+password)  // IKER: base64-encoded string of username:password.
    }
    if (baseURI) {
      this.baseURI = baseURI //  btoa(user+":"+password)  // IKER: base64-encoded string of username:password.
    }
    this.group = {
      name: 'OpenSLR',
      description: 'Default Open Systematic Literature Review',
      id: 1,
      url: this.baseURI
    }
    let q = "CREATE (:NamespacePrefixDefinition {`http://www.w3.org/ns/activitystreams#`: 'as',`http://xmlns.com/foaf/0.1/`: 'foaf', `http://www.w3.org/ns/oa#`: 'oa', `http://www.w3.org/ns/prov#`: 'prov', `http://rdf.onekin.org/resources/ns/`: 'onekin'})"
    this.commitNeo4J(this, q, console.log)
  }

  /**
     * Giving an annotation data, it is created in Neo4J
     * @param context The this object to access configuration data
     * @param queries queries
     * @param callback Function to execute after annotation creation
     */
  commitNeo4JMultiple (context, queries, callback) {
    let url = context.baseURI + '/db/data/transaction/commit'
    let sts = `{ "statements" : [ `
    let first = true
    for (let i = 0; i < queries.length; i++) {
      if (first) {
        first = false
        sts += `{"includeStats" : true, "statement" :  "` + queries[i] + `"}`
      } else {
        sts += `, {"includeStats" : true, "statement" :  "` + queries[i] + `"}`
      }
    }
    sts += ` ]}`
    //  console.log('MULTIPLE2----> ' + sts)
    let settings = {
      'async': true,
      'crossDomain': true,
      'url': url,
      'method': 'POST',
      'headers': {
        'authorization': 'Basic ' + context.userToken, // IKER https:// neo4j.com/docs/http-api/3.5/security/
        'content-type': 'application/json',
        'cache-control': 'no-cache'
      },
      data: sts
    }
    let apiCall = () => {
      axios(settings).catch(() => {
        if (_.isFunction(callback)) {
          callback(new Error('Unable to execute query::  ' + queries), [])
        }
      }).then((response) => {
        if (!_.isUndefined(response)) {
          if (!_.isUndefined(response.data.results[0])) console.log('RESULT:' + response.data.results[0])
          if (!_.isUndefined(response.data.errors[0])) console.log('ERROR::' + response.data.errors[0])
          let result = response.data
          callback(null, result)
        }
      })
    }
    apiCall()
  }

  /**
     * Giving an annotation data, it is created in Neo4J
     * @param context The this object to access configuration data
     * @param query
     * @param callback Function to execute after annotation creation
     */
  commitNeo4J (context, query, callback) {
    let url = context.baseURI + '/db/data/transaction/commit'
    let statement = `{ "statements" : [ {"includeStats" : true,
      "statement" :  "` + query + `"} ]}`
    //  console.log(statement)
    let settings = {
      'async': true,
      'crossDomain': true,
      'url': url,
      'method': 'POST',
      'headers': {
        'authorization': 'Basic ' + context.userToken, // IKER https:// neo4j.com/docs/http-api/3.5/security/
        'content-type': 'application/json',
        'cache-control': 'no-cache'
      },
      data: statement
    }
    let apiCall = () => {
      axios(settings).catch(() => {
        if (_.isFunction(callback)) {
          callback(new Error('Unable to execute query::  ' + query), [])
        }
      }).then((response) => {
        if (!_.isUndefined(response)) {
          if (!_.isUndefined(response.data.results[0])) console.log('RESULT:' + response.data.results[0])
          if (!_.isUndefined(response.data.errors[0])) console.log('ERROR::' + response.data.errors[0])
          let result = response.data
          callback(null, result)
        }
      })
    }
    apiCall()
  }

  /**
   * Lauches a cypher query and returns the rdf representation
   * @param cypher
   * @param callback
   */
  cypherRDFNeo4J (cypher, callback) {
    let url = this.baseURI + '/rdf/cypheronrdf'
    let statement = ` {"cypher" : "` + cypher + `"}`
    let settings = {
      'async': true,
      'crossDomain': true,
      'url': url,
      'method': 'POST',
      'headers': {
        'authorization': 'Basic ' + this.userToken, // IKER https:// neo4j.com/docs/http-api/3.5/security/
        'content-type': 'application/json',
        'Accept': 'application/ld+json',
        'cache-control': 'no-cache'
      },
      data: statement
    }
    console.log(statement)
    let apiCall = () => {
      axios(settings).catch(() => {
        if (_.isFunction(callback)) {
          callback(new Error('Unable to create annotation after '), [])
        }
      }).then((response) => {
        if (!_.isUndefined(response)) {
        //  let resptxt = JSON.stringify(response.data)
          // resptxt = resptxt.replace(new RegExp('http://rdf.onekin.org/resources/ns/', 'g'), '')
          // resptxt = infinitumReplacement(resptxt, '[{"@value":', '')
          // resptxt = resptxt.replace(new RegExp('}]', 'g'), '')
          // resptxt = resptxt.replace(new RegExp('http://www.w3.org/ns/oa#', 'g'), 'oa:')
          let expandedData = response.data
          // compact a document according to a particular context
          jsonld.compact(expandedData, { '@context': [ 'http://www.w3.org/ns/anno.jsonld', { '@vocab': 'http://rdf.onekin.org/resources/ns/' } ] }, function (err, compacted) {
            if (err) console.log('Error compacting: ' + err)
            callback(null, compacted)
          })
          //      console.log('cypherRDFNeo4J:: ' + resptxt)
          //    callback(null, response.data)
        }
      })
    }
    apiCall()
  }

  /**
   * Giving an annotation data, it is created in Neo4J
   * @param data Annotation {@link https:// h.readthedocs.io/en/latest/api-reference/#operation/createAnnotation body schema}
   * @param callback Function to execute after annotation creation
   */
  createNewAnnotation (data, callback) {
    debugger
    // let url = this.baseURI + '/db/data/transaction/commit'
    data['@id'] = randomString()
    //data['id'] = null
    data['text'] = null
    /*if (data['@type']) {
      if (data['@type'].push) {
        data['@type'].push('oa:Annotation')
      } else { data['@type'] = [data['@type'], 'oa:Annotation'] }
    } else {
      if (data['type']) {
        if (data['type'].push) {
          data['type'].push('Annotation')
        } else data['type'] = [data['type'], 'Annotation']
      } else data['@type'] = 'oa:Annotation'
    }*/
    data['permissions'] = null
    data['@context'] = [ 'http://www.w3.org/ns/anno.jsonld', { '@vocab': 'http://rdf.onekin.org/resources/ns/' } ]
    let q = []
    // q[0] = `CALL semantics.importRDFSnippet(' ` + escapify(data) + `', 'JSON-LD', {handleMultival: '1'})`
    q[0] = `CALL semantics.importRDFSnippet(' ` + escapify(data) + `', 'JSON-LD')`
    let cont = 0
    if (data['tags']) {
      cont++
      q[cont] = `MATCH (n{uri : '` +this.baseN4J+ data['id'] + `'}) SET  n.onekin__tags = ` + escapify(data['tags'])
    }
    if (data['references']) {
      cont++
      q[cont] = `MATCH (n{uri : '` +this.baseN4J+ data['id'] + `'}) SET  n.onekin__references = ` + escapify(data['references'])
    }
    console.log('Querying22: ' + q)
    this.commitNeo4JMultiple(this, q, (err, result) => {
      if (err) {
        let msg = 'Error creating annotation: ' + JSON.stringify(err)
        console.error()
        callback(new Error(msg))
      } else {
        data['user'] = this.userName
        data['id'] = data['@id']
        callback(null, data)
      }
    })
  }

  /**
   * Create a new, private group for the currently-authenticated user.
   * @param data Check the body request schema in https:// h.readthedocs.io/en/latest/api-reference/#operation/createGroup
   * @param callback
   */
  createNewGroup (data, callback) {
    callback(new Error('Neo4J does not manage groups'))
  }

  /**
   * Creates in Neo4J server sequentially a given list of annotations
   * @param annotations A list of annotation bodies
   * @param callback Function to execute after annotations are created
   * @return progress Holds progress of creating process, current and max values in number of pending annotations to finish.
   */
  createNewAnnotationsSequential (annotations, callback) {
    let createdAnnotations = []
    let progress = { current: 0, max: annotations.length }
    //  Create promise handler
    let runPromiseToCreateAnnotation = (d) => {
      return new Promise((resolve, reject) => {
        this.createNewAnnotation(d, (err, annotation) => {
          if (err) {
            reject(err)
          } else {
            createdAnnotations.push(annotation)
            resolve()
          }
        })
      })
    }
    let promiseChain = annotations.reduce(
      (chain, d, index) => {
        return chain.then(() => {
          progress.current = index //  Update progress current value
          return runPromiseToCreateAnnotation(d)
        })
      }, Promise.resolve()
    )
    promiseChain.catch((reject) => {
      if (_.isFunction(callback)) {
        callback(reject)
      }
    }).then(() => {
      progress.current = annotations.length
      if (_.isFunction(callback)) {
        callback(null, createdAnnotations)
      }
    })
  }

  /**
   * Create a list of annotations in parallel
   * @param annotations A list of annotation bodies
   * @param callback Function to execute after annotations are created
   */
  createNewAnnotationsParallel (annotations, callback) {
    let promises = []
    for (let i = 0; i < annotations.length; i++) {
      promises.push(new Promise((resolve, reject) => {
        this.createNewAnnotation(annotations[i], (err, response) => {
          if (err) {
            reject(err)
          } else {
            resolve(response)
          }
        })
        return true
      }))
    }
    Promise.all(promises).catch(() => {
      callback(new Error('Some annotations cannot be created'))
    }).then((responses) => {
      if (responses.length === annotations.length) {
                if (_.isFunction(callback)) {
                  callback(null, responses)
                }
      } else {
        if (_.isFunction(callback)) {
          callback(new Error('Some annotations cannot be created'))
        }
      }
    })
  }

  /**
   * Given an array of annotations creates them in the Neo4J server
   * @param annotations
   * @param callback
   */
  createNewAnnotations (annotations, callback) {
    if (_.isArray(annotations) && !_.isEmpty(annotations)) {
      this.createNewAnnotationsParallel(annotations, callback)
    } else {
      if (_.isFunction(callback)) {
        callback(new Error('Annotations object is not an array or is empty.'))
      }
    }
  }

  // /IK AQUI:..... cypher para obtener los grupos a los que pertenece el user. No roles.
  /**
   * Returns users profile:
   * @param callback
   */
  getUserProfile (callback) {
    let profile = {
      'userid': this.userName,
      'display_name': this.userName,
      groups: [this.group],
      'annotations': [ ]
    }
    callback(null, profile)
  }

  /**
   * Fetches an annotation by id
   * @param id
   * @param callback
   */
  fetchAnnotation (id, callback) {
    let cypher = `match (r)<-[c]-(n)-[a]->(p)-[b]->(q) where n.uri = '` +this.baseN4J+ id + `' return n,a,p,b,q, c, r`

    this.cypherRDFNeo4J(cypher, (err, data) => {
      if (err) {

      } else {
        console.log(JSON.stringify(data, null, 1))
        let newdata = this.transformJSON(data)
        console.log(JSON.stringify(newdata, null, 4))
        callback(null, newdata)
      }
    })
  }

  /**
   * Updates the annotation with::: IK: REMOVE AND INSERT????
   * @param id
   * @param data
   * @param callback
   */
  updateAnnotation (idold, data, callback) {
    let cN4J = this.commitNeo4J
    let updateAnnotationNext = (err, data) => {
      let id = data['id']
      if (err) {
        let msg = 'Error while updating the annotation'
        console.error(msg)
        callback(new Error(msg))
        return
      }
      // let cypher = `MATCH (n{uri : '` + id + `'})-->(p)-->(q) DETACH DELETE  n,p,q`
      let cypher = `MATCH (n{uri : '` +this.baseN4J+ id + `'})-->(p)-->(q),  (n1{uri : '` +this.baseN4J+ idold + `'})-->(p1)-->(q1) SET  n1=n, q1=q, n1.uri = '` +this.baseN4J+ idold + `'`
      console.log('VAAAA: ' + cypher)
      cN4J(this, cypher, (err, res) => {
        if (err) {

        } else {
      /*    this.deleteAnnotation(data, (err, res) => {
            if (err) console.error(err)
            callback(null, res)
          })*/
        }
      })
    }
    this.createNewAnnotation(data, updateAnnotationNext)
  }

  /**
   * Given an annotation or annotation id string, it deletes from Neo4J
   * @param annotation
   * @param callback
   */
  deleteAnnotation (annotation, callback) {
    let id = null
    if (_.isString(annotation)) {
      id = annotation
    } else if (_.has(annotation, 'id')) {
      id = annotation.id
    } else {
      callback(new Error('This is not an annotation or an annotation ID.'))
      return
    }
    let cypher = `MATCH (n{uri : '` +this.baseN4J+ id + `'})-[oa__hasTarget]->(p)-[oa__hasSelector]->(q) DETACH  DELETE  n,p,q`
    this.commitNeo4J(this, cypher, (err, data) => {
      if (err) {

      } else {
        callback(null, { deleted: true })
      }
    })
  }

  /**
   * Given a list of annotations or annotation ids, they are deleted in Neo4J
   * @param annotations a list of annotations or list of strings with each id
   * @param callback
   */
  deleteAnnotations (annotations, callback) {
    //  Check and parse annotations to a list of ids (if it is not yet)
    let toDeleteAnnotations = []
    if (_.every(annotations, (annotation) => { return annotation.id })) {
      toDeleteAnnotations = _.map(annotations, 'id')
    } else if (_.every(annotations, String)) {
      toDeleteAnnotations = annotations
    }
    //  Create promises to delete all the annotations
    let promises = []
    for (let i = 0; i < toDeleteAnnotations.length; i++) {
      promises.push(new Promise((resolve, reject) => {
        this.deleteAnnotation(toDeleteAnnotations[i], (err, response) => {
          if (err) {
            reject(new Error('Unable to delete annotation id: ' + toDeleteAnnotations.id))
          } else {
            resolve(response)
          }
        })
        return true
      }))
    }
    //  When all the annotations are deleted
    Promise.all(promises).catch((rejectedList) => {
      //  TODO List of rejected annotations
      callback(new Error('Unable to delete some annotations: '))
    }).then((responses) => {
      callback(null, responses)
    })
  }

  /**
   * Search annotations
   * @param data
   * @param callback
   */
  searchAnnotations (data, callback) {
    // /Search by .....? Id, tags, group, user???
    let q = ''
    // URL

    if (data.id) {
      q = `match (r)<-[c]-(n)-[a]->(p)-[b]->(q) where n.uri = '` +this.baseN4J+ data.id + `' return n,a,p,b,q, c, r`
    }
    if (data.uri) {
        q = `match (r)<-[c]-(n)-[a]->(p)-[b]->(q) where n.onekin__uri = '` + data.uri + `' return n,a,p,b,q, c, r`
    }
    if (data.url) {
        q = `match (r)<-[c]-(n)-[a]->(p)-[b]->(q) where n.onekin__uri = '` + data.url + `' return n,a,p,b,q, c, r`
    }
    // User
    if ((data.user)) {
      q = `match (r)<-[c]-(n)-[a]->(p)-[b]->(q), (n)-[dct__creator]->(n2) where n2.uri = '` + data.user + `' return n,a,p,b,q,c,r`
    }

    // Tags
    if ((data.tag || data.tags)) {
      let tags = []
      if (_.isArray(data.tags) && _.every(data.tags, _.isString)) {
        tags = data.tags
      }
      if (_.isString(data.tags)) {
        tags.push(data.tags)
      }
      if (_.isString(data.tag)) {
        tags.push(data.tag)
      }
      // Remove duplicated tags
      tags = _.uniq(tags)
      // Check if annotation's tags includes all the tags
      q = `match (n)-->(p)-->(q)  WHERE '` + data.tag + `' IN n.onekin__tags return n,p,q`
      q = `match (r)<-[c]-(n)-[a]->(p)-[b]->(q)  WHERE '` + data.tag + `' IN n.onekin__tags return n,a,p,b,q, c, r`
    }

    this.cypherRDFNeo4J(q, (err, data) => {
      if (err) {

      } else {
        let newData = this.transformJSON(data)
        /*
        let newData = []
        let subnewData = data['@graph'] || []
        for (let i= 0; i< subnewData.length; i++){
          let ann= subnewData[i]
          ann['@context'] = subnewData['@context']
          newData.push (ann)
        }
        */
        console.log('searching: ' + JSON.stringify(newData, null, 2))
        callback(null, newData)
      }
    })
  }

  /**
   * Transform
   * @param data json
   * @return annotation json in required format
   */
  transformJSON (data) {
    let txt = JSON.stringify(data, null, 1)
    txt = txt.replace(new RegExp('"id": "http://neo4j.com/base/', 'g'), '"id": "')
    data = JSON.parse(txt)
    let ctxt = data['@context']
    let grafus = data['@graph'] || {}
    let idTextQuoteSelector = {}
    let idTarget = {}
    let annotation = []
    for (let i = 0; i < grafus.length; i++) {
      let olddatum = grafus[i]
      if (olddatum['type']){
        if (olddatum['type'] === 'Annotation') {
          olddatum['@context'] = ctxt
          annotation.push(olddatum)
        }
        if (olddatum['type'].endsWith("Selector")) { // === 'TextQuoteSelector') {
            idTextQuoteSelector[olddatum['id']] = olddatum
        }
      }else {
          idTarget[olddatum['id']] = olddatum
      }
      }

    let anntxt = JSON.stringify(annotation, null, 3)
    let list = idTarget
    for (let j in list) {
      let key = j
      let val = list[j]
      console.log(j + ' :::> ' + val)
      anntxt = anntxt.replace(new RegExp('"' + key + '"', 'g'), JSON.stringify(val))
    }
    list = idTextQuoteSelector
    for (let j in list) {
      let key = j
      let val = list[j]
      console.log(j + ' :::> ' + val)
      anntxt = anntxt.replace(new RegExp('"' + key + '"', 'g'), JSON.stringify(val))
    }
    console.log(anntxt)
    annotation = JSON.parse(anntxt)
    return annotation
  }

  /**
   * Get list of groups for current user
   * @param data
   * @param callback
   */
  getListOfGroups (data, callback) {
    callback(null, this.group)
  }

  /**
   * Update a group metadata: name, description or id (only for Authorities). Check: https:// h.readthedocs.io/en/latest/api-reference/#tag/groups/paths/~1groups~1{id}/patch
   * @param groupId
   * @param data
   * @param callback
   */
  updateGroup (groupId, data, callback) {
    callback(new Error('Neo4J does not manage groups'))
  }

  /**
   * Retrieve a group data by its ID
   * @param groupId
   * @param callback
   */
  fetchGroup (groupId, callback) {
    callback(new Error('Neo4J does not manage groups'))
  }

  /**
   * Remove a member from a Neo4J group. Currently only is allowed to remove yourself.
   * @param data
   * @param callback
   */
  removeAMemberFromAGroup (data, callback) {
    callback(new Error('Neo4J does not manage groups'))
  }
}
module.exports = Neo4JClient
