/******************************************************/
// constants and string values used like enums
/******************************************************/

// site enums
const SITE_TWITTER = 'twitter';

// whether/how to render anchors
RENDER_A_MDON_ONLY = 'mdonOnly';
RENDER_A_EMAIL_ONLY = 'emailOnly';
RENDER_A_EXTURL_ONLY = 'urlOnly';
RENDER_A_ALL = 'all';


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
