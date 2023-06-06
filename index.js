const express = require('express');
const app = express();
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Languages are being learned')
})

app.listen(port, () => {
    console.log(`Language express is running on port ${port}`);
})