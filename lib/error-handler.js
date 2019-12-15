const Sentry = require('@sentry/node');
const timeout = require('connect-timeout');
const uuidv4 = require('uuid/v4');

const { Exception } = require('./messages/flow');
const isRequestFromSlack = require('./is-request-from-slack');

function defaultErrorInfo(req, res) {
  const { command } = res.locals;
  const hasSentryRef = res.sentry !== undefined;
  return {
    reqBody: req.body,
    reqUrl: req.url,
    resBody: res.body,
    sentryRef: res.sentry,
    hasSentryRef,
    command,
  };
}

module.exports = {
  setup: (app) => {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      release: process.env.HEROKU_SLUG_COMMIT || "Unknown",
    });

    app.use(Sentry.Handlers.requestHandler());

    const timeoutValue = '10s';
    app.use(timeout(timeoutValue));
    app.use((req, res, next) => {
      req.on('timeout', () => {
        const errorInfo = {
          ...defaultErrorInfo,
          isTimeout: true,
        };
        req.log.warn(errorInfo, `Request timed out after ${timeoutValue}.`);
      });

      next();
    });

    // Route for testing error handling
    app.get('/boom', (req) => {
      const err = new Error('Boom');
      if (req.query.async) {
        return Promise.reject(err);
      }
      throw err;
    });
  },

  teardown: (app) => {
    // The error handler must be before any other error middleware
    app.use(Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Capture all 400 and 500 errors
        return error.status >= 400
      }
    }))

    // eslint-disable-next-line no-unused-vars
    app.use((error, req, res, _next) => {
      const customRef = `gh-${uuidv4()}`;
      const { command } = res.locals;
      const ref = (res.sentry || customRef);

      const errorInfo = {
        ...defaultErrorInfo(req, res),
        ref,
        customRef,
        error,
        isTimeout: false,
      };
      req.log.error(errorInfo, 'Fatal error occured.');

      const message = new Exception(ref, command).toJSON();

      if (command) {
        return command.respond(message);
      } else if (res.headersSent) {
        req.log.warn({ error, ref }, 'Headers were already sent. Not responding to user.');
      } else if (isRequestFromSlack(req)) {
        res.json(message);
      } else {
        res.status(500).send(`An unexpected error occured. ref: ${ref}`);
      }
    });
  },
};
