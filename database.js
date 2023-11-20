// database.js
const mysql = require('mysql2');
require('dotenv').config();

// Using PlanetScale connection URL
const connection = mysql.createConnection(process.env.DATABASE_URL);

connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to PlanetScale Database!');
});

module.exports = connection;