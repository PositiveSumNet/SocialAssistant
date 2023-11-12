var PUSH_MERGER_FACTORY = {
  getPushMerger: function(stepType) {
    switch (stepType) {
      case SYNCFLOW.STEP_TYPE.profileFavorites:
        return PROFILE_FAVORITES_PUSH_MERGER;
      case SYNCFLOW.STEP_TYPE.profiles:
        return PROFILES_PUSH_MERGER;
      case SYNCFLOW.STEP_TYPE.profileImgs:
        return PROFILE_IMGS_PUSH_MERGER;
      case SYNCFLOW.STEP_TYPE.networkFollowings:
        return NETWORK_FOLLOWINGS_PUSH_MERGER;
      case SYNCFLOW.STEP_TYPE.networkFollowers:
        return NETWORK_FOLLOWERS_PUSH_MERGER;
      case SYNCFLOW.STEP_TYPE.postTopicRatings:
        return POST_TOPIC_RATINGS_PUSH_MERGER;
      case SYNCFLOW.STEP_TYPE.posts:
        return POSTS_PUSH_MERGER;
      case SYNCFLOW.STEP_TYPE.postImgs:
        return POST_IMGS_PUSH_MERGER;
      default:
        return null;
    }
  }
};