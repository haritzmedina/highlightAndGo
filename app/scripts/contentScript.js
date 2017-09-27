// Load annotations for this page

const HypothesisClient = require('./hypothesis/HypothesisClient')

const TOKEN = ''

function go () {
  let hypothesisClient = new HypothesisClient(TOKEN)
  hypothesisClient.createNewAnnotation({
    'group': '__world__',
    'permissions': {
      'read': [
        'group:__world__'
      ]
    },
    'references': [
    ],
    'tags': [
      'test'
    ],
    'target': [
      {
        'selector':
          [
            {
              'exact': 'Haritz Medina',
              'prefix': 'mi nombre es ',
              'type': 'TextQuoteSelector',
              'suffix': ' y este es mi sitio'
            }
          ]
      }
    ],
    'body': {
      'type': 'TextualBody',
      'value': 'Example',
      'format': 'text/html',
      'language': 'en'
    },
    'uri': 'https://haritzmedina.com',
    'motivation': 'highlighting'
  }, (response) => {
    console.log(response)
    // browser.url(WEBSITE_URL)
  })
}

// go()
