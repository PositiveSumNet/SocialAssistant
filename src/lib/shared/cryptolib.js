var CRYPTO = {
  HASH_METHOD: {
    SHA1: 'SHA-1',
    SHA2: 'SHA-256'
  },
  
  // stackoverflow.com/a/40031979/9014097
  buf2hex: function (buffer) { // buffer is an ArrayBuffer
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
  },

  // stackoverflow.com/a/11562550/9014097
  buf2Base64: function(buffer) {
    return btoa([].reduce.call(new Uint8Array(buffer),function(p,c){return p+String.fromCharCode(c)},''));
  },

  utf8ByteLen: function(str) {
    if (!str || str.length == 0) { return 0; }
    const inputBytes = new TextEncoder().encode(str);
    return inputBytes.length;
  },

  // stackoverflow.com/questions/63736585/why-does-crypto-subtle-digest-return-an-empty-object
  hash: async function(str, method) {
    if (!str || str.length == 0) { return null; }
    const inputBytes = new TextEncoder().encode(str);
    const hashBytes = await window.crypto.subtle.digest(method, inputBytes);
    const hashedStr = CRYPTO.buf2hex(hashBytes);
    return hashedStr;
  }
};