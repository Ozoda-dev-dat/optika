import http from 'http';

// Test creating a category first
const createOptions = {
  hostname: '127.0.0.1',
  port: 3006,
  path: '/api/categories',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const createData = JSON.stringify({
  name: 'Test Category for Delete'
});

const createReq = http.request(createOptions, (res) => {
  console.log(`CREATE STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`CREATE BODY: ${chunk}`);
    
    // Parse the created category ID
    const createdCategory = JSON.parse(chunk);
    if (createdCategory.id) {
      // Now test deleting it
      const deleteOptions = {
        hostname: '127.0.0.1',
        port: 3006,
        path: `/api/categories/${createdCategory.id}`,
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const deleteReq = http.request(deleteOptions, (deleteRes) => {
        console.log(`DELETE STATUS: ${deleteRes.statusCode}`);
        deleteRes.setEncoding('utf8');
        deleteRes.on('data', (deleteChunk) => {
          console.log(`DELETE BODY: ${deleteChunk}`);
        });
      });

      deleteReq.on('error', (e) => {
        console.error(`DELETE ERROR: ${e.message}`);
      });

      deleteReq.end();
    }
  });
});

createReq.on('error', (e) => {
  console.error(`CREATE ERROR: ${e.message}`);
});

createReq.write(createData);
createReq.end();
