var IMPORT_MAPPER_FACTORY = {
  getMapper: function(stepType) {
    switch (stepType) {
      case SYNCFLOW.STEP_TYPE.profileFavorites:
        return PROFILE_FAVORITES_IMPORT_MAPPER;
      case SYNCFLOW.STEP_TYPE.profiles:
        return PROFILES_IMPORT_MAPPER;
      case SYNCFLOW.STEP_TYPE.profileImgs:
        return PROFILE_IMGS_IMPORT_MAPPER;
      case SYNCFLOW.STEP_TYPE.networkFollowings:
      case SYNCFLOW.STEP_TYPE.networkFollowers:
        return NETWORK_IMPORT_MAPPER;
      case SYNCFLOW.STEP_TYPE.postTopicRatings:
        return POST_TOPIC_RATINGS_IMPORT_MAPPER;
      case SYNCFLOW.STEP_TYPE.posts:
        return POSTS_IMPORT_MAPPER;
      case SYNCFLOW.STEP_TYPE.postImgs:
        return POST_IMGS_IMPORT_MAPPER;
      default:
        return null;
    }
  }
};