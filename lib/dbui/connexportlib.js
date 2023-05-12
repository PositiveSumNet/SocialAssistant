// to help export function winnow down to just the site or network owner or graphs we want
var CONN_EXPORT_HELPER = {

  recentlyModifiedFilter: function(hoursAgo) {
    if (!hoursAgo || hoursAgo == 0) { return undefined; }
    const x = EXPORT_ROOT_ALIAS;
    const timestampCol = SCHEMA_CONSTANTS.COLUMNS.Timestamp;
    const since = `-${hoursAgo} hours`;
    return `${x}.${timestampCol} > datetime('now', '${since}')`;
  },

  justThisSiteFilter: function(site) {
    if (!site) { return undefined; }
    const x = EXPORT_ROOT_ALIAS;
    const graphCol = SCHEMA_CONSTANTS.COLUMNS.NamedGraph;
    return `${x}.${graphCol} LIKE '${APPGRAPHS.getGraphsStartWithBySite(site)}'`;
  },

  // { entity: entity joiner: ..., condition: ..., skip: bool }
  // note that the entity itself uses EXPORT_ROOT_ALIAS (x)
  entityFilter: function(entity, owner, direction) {
    const filter = { entityName: entity.Name };
    if (!owner) { return filter; }
    if (!direction) { return filter; }
    const x = EXPORT_ROOT_ALIAS;
    const conn = 'conn';
    let joiner = undefined;
    let condition = undefined;
    let skip = false;

    let connEnt = undefined;
    switch (direction) {
      case CONN_DIRECTION.FOLLOWING:
        connEnt = APPSCHEMA.SocialConnIsFollowing;
        break;
      case CONN_DIRECTION.FOLLOWERS:
        connEnt = APPSCHEMA.SocialConnHasFollower;
        break;
      default:
        connEnt = APPSCHEMA.SocialConnection;
        break;
    }

    switch (entity.Name) {
      case APPSCHEMA.SocialConnHasFollower.Name:
      case APPSCHEMA.SocialConnIsFollowing.Name:
      case APPSCHEMA.SocialConnection.Name:
        if (connEnt.Name != entity.Name) {
          skip = true;
        }
        else {
          condition = `${x}.${entity.SubjectCol} = '${owner}'`;
        }
        break;

      case APPSCHEMA.SocialProfileDisplayName.Name:
      case APPSCHEMA.SocialProfileDescription.Name:
      case APPSCHEMA.SocialProfileImgSourceUrl.Name:
      case APPSCHEMA.SocialProfileImgBinary.Name:
      case APPSCHEMA.SocialProfileLinkMastodonAccount.Name:
      case APPSCHEMA.SocialProfileLinkExternalUrl.Name:
      case APPSCHEMA.SocialProfileLinkEmailAddress.Name:
      case APPSCHEMA.SocialFollowerCount.Name:
      case APPSCHEMA.SocialFollowingCount.Name:
        joiner = `JOIN ${connEnt.Name} ${conn} ON ${conn}.${connEnt.ObjectCol} = ${x}.${entity.SubjectCol}`;
        condition = `${conn}.${connEnt.SubjectCol} = '${owner}'`;
        break;
      case APPSCHEMA.SocialListMember.Name:
        joiner = `JOIN ${connEnt.Name} ${conn} ON ${conn}.${connEnt.ObjectCol} = ${x}.${entity.ObjectCol}`;
        condition = `${conn}.${connEnt.SubjectCol} = '${owner}'`;
        break;
      case APPSCHEMA.SocialSourceIdentifier.Name:
        // not in use  
        return filter;
      default:
        return filter;
    }

    if (joiner) {
      filter.joiner = joiner;
    }
    if (condition) {
      filter.condition = condition;
    }
    if (skip) {
      filter.skip = skip;
    }
    return filter;
  }
}