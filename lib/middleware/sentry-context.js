const Sentry = require('@sentry/node');

module.exports = (req, res, next) => {
  Sentry.configureScope(function(scope) {
    scope.setExtra("user", {
      username: req.body.user_name,
      id: req.body.user_id,
      workspace: req.body.team_domain,
      workspace_id: req.body.team_id,
    });
    scope.setExtra("channel_id", req.body.channel_id);
    scope.setExtra("channel_name", req.body.channel_name);
    scope.setExtra("trigger_id", req.body.trigger_id);

    next();
  });
};
