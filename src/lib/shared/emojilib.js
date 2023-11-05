/********************************************************************/
// Most emojis can be saved as text and re-rendered.
// But Microsoft won't render flags such as '🇺🇸' so we use a trick
// with flags.css
/********************************************************************/

const _emojiRegex = /\p{Emoji}/u;

// unicode.org/reports/tr51/#EBNF_and_Regex
// rendering is via flags.css
const _flagRegexCapture = /(\p{RI}\p{RI})/ug;

var EMOJI = {
  
  // emojiguide.org/thread
  THREAD: '&#129525;',

  // www.wisdomgeek.com/development/web-development/javascript/how-to-check-if-a-string-contains-emojis-in-javascript/
  isEmoji: function(txt) {
    if (!txt || txt.length === 0) {
      return false;
    }
    
    return _emojiRegex.test(txt);
  },

  // figured this out by analyzing a-z values from:
  // emojipedia.org/regional-indicator-symbol-letter-a/
  // console.log('🇦'.charCodeAt(1));
  // console.log('a'.charCodeAt(0));
  // console.log('🇿'.charCodeAt(1));
  // console.log('z'.charCodeAt(0));
  unicodeRegionCharToAscii: function(u) {
    if (u.charCodeAt(0) != 55356) {
      return u;
    }
    
    let ucc = u.charCodeAt(1);
    if (!ucc) { return u; }
    if (ucc < 56806 || ucc > 56831) { return u; }
    let asciCode = ucc - 56709;     // by analyzing regional 'a' vs ascii 'a'
    // convert it to char
    let chr = String.fromCharCode(asciCode);
    return chr;
  },

  // stackoverflow.com/questions/24531751/how-can-i-split-a-string-containing-emoji-into-an-array
  emojiStringToArray: function(str) {
    const split = str.split(/([\uD800-\uDBFF][\uDC00-\uDFFF])/);
    const arr = [];
    for (let i=0; i < split.length; i++) {
      let char = split[i]
      if (char !== "") {
        arr.push(char);
      }
    }
    
    return arr;
  },

  injectFlagEmojis: function(raw) {
    if (!raw) { return raw; }
    
    return raw.replace(_flagRegexCapture, function(matched) { 
      const emojiArr = EMOJI.emojiStringToArray(matched);
      const asChars = emojiArr.map(function(u) { return EMOJI.unicodeRegionCharToAscii(u); });
      const concat = asChars.join('');
      return `<i class="flag flag-${concat}"></i>`; 
    });
  }
  
};