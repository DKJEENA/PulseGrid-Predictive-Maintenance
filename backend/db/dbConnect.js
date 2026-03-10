const mongoose = require("mongoose");
require("dotenv").config();

async function dbConnect() {
  if (!process.env.DB_URL) {
    console.warn("DB_URL is not set. Skipping legacy MongoDB connection.");
    return;
  }

  mongoose
    .connect(process.env.DB_URL)
    .then(() => {
      console.log("Successfully connected to MongoDB Atlas!");
    })
    .catch(error => {
      console.log("Unable to connect to MongoDB Atlas!");
      console.error(error);
    });
}

module.exports = dbConnect;
