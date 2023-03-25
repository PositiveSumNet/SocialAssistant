var SETTINGS = {
  
  AGREED_TO_TERMS: 'agreedToTerms',
  RECORDING: 'recording',
  PAGING: {
    PAGE_SIZE: 'pageSize'
  },
  
  getMdonServer: function() {
    return localStorage.getItem('mdonServer');
  }
  
}