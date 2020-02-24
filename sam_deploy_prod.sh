sam build --template sam-template.yaml
aws-okta exec github-pr-channels-admin -- sam package --s3-bucket github-slack-channels --s3-prefix githubprchannels --output-template-file output-template.yml
aws-okta exec github-pr-channels-admin -- sam deploy \
--template-file output-template.yml \
--stack-name GitHubSlack-LambdaStack \
--s3-bucket github-slack-channels \
--s3-prefix githubprchannels \
--capabilities CAPABILITY_IAM \
--parameter-overrides AppEnv="prod" LogLevel="warn"
