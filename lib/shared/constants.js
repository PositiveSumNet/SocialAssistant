/******************************************************/
// constants and string values used like enums
/******************************************************/

// site enums
var SITE = {
  TWITTER: 'twitter'
}

// the type of page the user is looking at
var PAGETYPE = {
  TWITTER: {
    FOLLOWERS: 'followersOnTwitter',
    FOLLOWING: 'followingOnTwitter'
  }
}

// whether/how to render anchors
var RENDER_A_RULE = {
  MDON_ONLY: 'mdonOnly',
  EMAIL_ONLY: 'emailOnly',
  EXTURL_ONLY: 'urlOnly',
  ALL: 'all'
}


/******************************************************/
// Regular expressions
/******************************************************/

const REGEX_EMAIL = /(?:^|\s|\()([A-Za-z0-9._%+-]+(@| at |\(at\))[A-Za-z0-9.-]+(\.| dot |\(dot\))[A-Za-z]{2,4})\b/g;
const REGEX_URL = /http[s]?:\/\/[^\s]+/g;
// @scafaria@toad.social
const REGEX_MDON1 = /(?:^|\s|\()@([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,20})\b/g;
// toad.social/@scafaria
const REGEX_MDON2 = /(?:^|\s|\()(https?:\/\/)?(www\.)?([A-Za-z0-9.-]+\.[A-Za-z]{2,20})\/@([A-Za-z0-9._%+-]+)\b/g;
// scafaria@toad.social
// note the missed starting @ -- and instead of trying to keep up with all the server instances
// we simply hard-wire to detect this syntax when it's "xyz.social" (or xyz.online)
const REGEX_MDON3 = /(?:^|\s|\()([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.(social|online))\b/g;
