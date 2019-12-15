sam build --template sam-template.yml
aws-okta exec sandbox-engineer -- sam package --s3-bucket github-slack --s3-prefix sandbox --output-template-file output-template.yml
aws-okta exec sandbox-engineer -- sam deploy \
--template-file output-template.yml \
--stack-name GitHubSlack-LambdaStack \
--s3-bucket github-slack \
--s3-prefix sandbox \
--capabilities CAPABILITY_IAM \
--parameter-overrides AppEnv="sandbox" LogLevel="debug"
