# Highlight And Go
[![Build Status](https://travis-ci.com/haritzmedina/highlightAndGo.svg?token=iYaEys7GiGsu2prhEJWx&branch=master)](https://travis-ci.com/haritzmedina/highlightAndGo)

Chrome extension that tracks highlighting activity while reading primary studies during data extraction activity in a Systematic Literature Review. It creates a spreadsheet for easy checking Inter-rating reliability, the current status of the activity and direct links to coding evidences. Highlighting activity can be stored in local, hypothes.is or neo4j.

# For End-users
End users require a hypothesis and Google Sheet account. Download extension from [Chrome Store](https://chrome.google.com/webstore/detail/highlightgo/bihmalipgnlomidlpekdnoohiejppfmo).

End-users documentation is in the [For End-users wiki page](https://github.com/haritzmedina/highlightAndGo/wiki/For-end-users).

# For developers


# For contributors


## Installation

	$ npm install

## Usage

Run `$ gulp --watch` and load the `dist`-directory into chrome.

## Entryfiles (bundles)

There are two kinds of entryfiles that create bundles.

1. All js-files in the root of the `./app/scripts` directory
2. All css-,scss- and less-files in the root of the `./app/styles` directory

## Tasks

### Build

    $ gulp


| Option         | Description                                                                                                                                           |
|----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| `--watch`      | Starts a livereload server and watches all assets. <br>To reload the extension on change include `livereload.js` in your bundle.                      |
| `--production` | Minifies all assets                                                                                                                                   |
| `--verbose`    | Log additional data to the console.                                                                                                                   |
| `--vendor`     | Compile the extension for different vendors (chrome, firefox, opera, edge)  Default: chrome                                                                 |
| `--sourcemaps` | Force the creation of sourcemaps. Default: !production                                                                                                |


### Pack

Zips your `dist` directory and saves it in the `packages` directory.

    $ gulp pack --vendor=firefox

### Version

Increments version number of `manifest.json` and `package.json`,
commits the change to git and adds a git tag.


    $ gulp patch      // => 0.0.X

or

    $ gulp feature    // => 0.X.0

or

    $ gulp release    // => X.0.0


## Globals

The build tool also defines a variable named `process.env.NODE_ENV` in your scripts. It will be set to `development` unless you use the `--production` option.


**Example:** `./app/background.js`

```javascript
if(process.env.NODE_ENV === 'development'){
  console.log('We are in development mode!');
}
```

## Testing

There are some basic tests to verify that the extension works as expected. You can run them manually using:


    $ npm test



