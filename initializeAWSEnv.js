const AWS = require('aws-sdk')


module.exports = async () => {
  const AppEnv = process.env.APP_ENV

  if (AppEnv === 'local') {
    return
  }

  const region = process.env.GITHUB_SECRETS_REGION
  const client = new AWS.SecretsManager({ region })
  const SecretId = process.env.GITHUB_SECRETS_ID
  const data = await client.getSecretValue({ SecretId }).promise()
  const secrets = JSON.parse(data.SecretString)

  // Set the secrets as env variables directly. This might not be a wise security decision...
  for (let key of Object.keys(secrets)) {
    process.env[key] = secrets[key]
  }

  // console.log(process.env)
}
