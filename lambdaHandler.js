const Sentry = require('@sentry/node')
const { exec } = require('child_process')
const initializeAWSEnv = require('./initializeAWSEnv')
const serverlessExpress = require('aws-serverless-express')

module.exports.probot = async (event, context) => {
  // Load env vars from SecretsManager
  try {
    await initializeAWSEnv()
  } catch (error) {
    console.error(error)
    return context.done(null, {
      statusCode: 500,
      body: JSON.stringify(error)
    })
  }

  if (event.path === "/dbmigrate/") {
    try {
      await new Promise((resolve, reject) => {
        const migrate = exec(
          'node_modules/sequelize-cli/lib/sequelize db:migrate',
          {env: process.env},
          (err, stdout, stderr) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          }
        )

        let migrateOutput = '';
        migrate.stdout.on('data', (chunk) => {
          migrateOutput += chunk.toString();
        });

        migrate.on('exit', function (code) {
          console.log(migrateOutput)
          console.log(`Database migration completed with error code ${code}.`)
        })
      })
    } catch (error) {
      console.error(error)
      await Sentry.flush(2500);
      return context.done(null, {
        statusCode: 500,
        body: JSON.stringify(error)
      })
    }

    return context.done(null, {
      statusCode: 200,
      body: JSON.stringify(`Migration complete.`)
    })
  }

  const { findPrivateKey } = require('probot/lib/private-key')
  const { createProbot } = require('probot')
  const appFn = require('./lib')

  const probot = createProbot({
    id: process.env.APP_ID,
    secret: process.env.WEBHOOK_SECRET,
    cert: findPrivateKey(),
    port: process.env.PORT || 3000,
    webhookPath: '/github/events',
    webhookProxy: process.env.WEBHOOK_PROXY_URL,
  })

  probot.load(appFn)

  const server = probot.server
  server._socketPathSuffix = Math.random().toString(36).substring(2, 15)
  server._binaryTypes = []

  console.log("TEST POINT A")

  const result = serverlessExpress.proxy(server, event, context, "PROMISE")
  const response = await result.promise
  console.log("RESPONSE", response)
  return context.done(null, response)
}
