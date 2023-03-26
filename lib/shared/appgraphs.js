// The RDF spec (w3.org/rdf) provides inspiration. 
// Data can be represented as quads (Subject, Predicate, Object, NamedGraph).
// The entity/table name holds knowledge of the Predicate.
// And NamedGraph can be used to represent provenance.
// Note that within the DB, the URI prefix (e.g. https://whosum.com/graph/) can be omitted.
// Until identity is proven (a requirement for sharing across users), the placeholder 'MYSELF' is used to refer to the local user.

var APPGRAPHS = {
  MYSELF: 'MYSELF',

  PARM_NAME: {
    SITE: 'site',
    CONTRIBUTOR: 'contributor'
  },
  
  getMyTwitterGraph: function() {
    return APPGRAPHS.getGraph(SITE.TWITTER);
  },
  
  getGraph: function(site, contributor = APPGRAPHS.MYSELF) {
    return `${APPGRAPHS.PARM_NAME.SITE}=${site}&${APPGRAPHS.PARM_NAME.CONTRIBUTOR}=${contributor}`;
  }
};