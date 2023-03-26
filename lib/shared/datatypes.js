var DATATYPES = {
  // standard
  TEXT: 'text',
  DATETIME: 'datetime',
  BOOLEAN: 'boolean',
  INTEGER: 'integer',
  FLOAT: 'float',
  
  // special
  LIST_NAME: 'list',
  ACCOUNT_HANDLE: 'account-handle',
  EMAIL_ADDRESS: 'email-address',
  MASTODON_ACCOUNT_URL: 'mastodon-account-url',
  // (not mastodon)
  EXTERNAL_URL: 'url',
  // an image at its original location
  IMG_SOURCE_URL: 'image-source-url',
  // an image cached into binary data
  IMG_BINARY: 'image-binary'
};