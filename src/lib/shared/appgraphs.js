// The RDF spec (w3.org/rdf) provides inspiration. 
// Data can be represented as quads (Subject, Predicate, Object, NamedGraph).
// The entity/table name holds knowledge of the Predicate.
// And NamedGraph can be used to represent provenance.
// Note that within the DB, the URI prefix (e.g. https://whosum.com/graph/) can be omitted.
// Until identity is proven (a requirement for sharing across users), the placeholder 'MYSELF' is used to refer to the local user.

var APPGRAPHS = {
  MYSELF: 'MYSELF',
  METADATA: 'METADATA',

  PARM_NAME: {
    SITE: 'site',
    CONTRIBUTOR: 'contributor'
  },
  
  // for including graphs sourced from multiple contributors (use with LIKE operator)
  getGraphsStartWithByPageType: function(pageType) {
    const site = PAGETYPE.getSite(pageType);
    return APPGRAPHS.getGraphsStartWithBySite(site);
  },
  
  // for including graphs sourced from multiple contributors (use with LIKE operator)
  getGraphsStartWithBySite: function(site) {
    return `${APPGRAPHS.PARM_NAME.SITE}=${site}%`;
  },
  
  getGraphByPageType: function(pageType, contributor = APPGRAPHS.MYSELF) {
    const site = PAGETYPE.getSite(pageType);
    return APPGRAPHS.getGraphBySite(site, contributor);
  },
  
  getGraphBySite: function(site, contributor = APPGRAPHS.MYSELF) {
    return `${APPGRAPHS.PARM_NAME.SITE}=${site}&${APPGRAPHS.PARM_NAME.CONTRIBUTOR}=${contributor}`;
  },

  getSiteFromGraph: function(graph) {
    if (!graph) {
      return undefined;
    }
    
    const kvps = graph.split('&');
    for (let i = 0; i < kvps.length; i++) {
      let kvp = kvps[i];
      let parts = kvp.split('=');
      if (parts.length === 2 && parts[0] == APPGRAPHS.PARM_NAME.SITE) {
        let site = parts[1];
        return site;
      }
    }

    return undefined;
  }
};