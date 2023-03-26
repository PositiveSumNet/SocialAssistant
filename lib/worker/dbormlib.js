// ORM for the database (library-level; excludes domain-specific code)
// We've chosen to standardize tables to an RDF quad approach: Subject, Object, NamedGraph (provenance) [with Predicate as part of the table metadata]
// A Timestamp column also aids with sync. And deleted records can be retained (to allow sync of deletions also) by modifying the 
// Timestamp from e.g. '2023-03-26 14:04:40.000' to '-2023-03-26 14:04:40.000'.
// These tricks around Predicate and Timestamp allow us to get by with a minimum of indexes and a maximum standardization (code reuse).

var DBORM = {
  
};