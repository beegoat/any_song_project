const express = require('express')
const app = express()
const port = 3000

app.get('/', (req, res) => {
  res.send('Any song!')
})

app.route('/book')
  .get(function(req, res) {
    res.send('Get a random book');
  })
  .post(function(req, res) {
    res.send('Add a book');
  })
  .put(function(req, res) {
    res.send('Update the book');
  });
  

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})