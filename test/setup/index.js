const { exec } = require('child_process');
require('./env');
require('./nock');

// @todo: Should create and destroy database for each test suite
exec('./node_modules/.bin/sequelize db:migrate', (err, stdout, stderr) => {
  if (err) {
    console.log(`stderr: ${stderr}`); // eslint-disable-line no-console
    console.log(`stdout: ${stdout}`); // eslint-disable-line no-console
    console.log('err', err); // eslint-disable-line no-console
    // node couldn't execute the command
  }
});
