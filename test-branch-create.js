import http from 'http';

const options = {
  hostname: '127.0.0.1',
  port: 3005,
  path: '/api/branches',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const postData = JSON.stringify({
  name: 'Test Branch',
  address: '123 Test St',
  phone: '123-456-7890',
  isWarehouse: false
});

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
});

req.write(postData);
req.end();
