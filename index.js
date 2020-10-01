'use strict';

const express = require('express');
const path = require('path');
const morgan = require('morgan');
const Bot = require('./bot');

const app = express();
const PORT = 3000;

// app.use(morgan('combined'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname+'/html/index.html')));
app.listen(PORT, () => console.log(`[main] discord bot app listening at http://localhost:${PORT}`));

const bot = new Bot(app);

module.exports = 0;