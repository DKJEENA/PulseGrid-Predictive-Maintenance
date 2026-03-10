const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const bodyParser = require('body-parser');
const auth = require("./auth");
const dbConnect = require("./db/dbConnect");
const fs = require("fs");
const mongoose = require("mongoose");
const pdmStore = require("./db/pdmStore");
dbConnect();
pdmStore.ensureDatabase();
var cors = require("cors");
app.use(cors());

// body parser configuration
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (request, response, next) => {
    response.json({ message: "Hey! This is your server response!" });
    next();
});


app.get("/api/v2/health", (req, res) => {
    res.json({
        ok: true,
        service: "predictive-maintenance-v2",
        timestamp: new Date().toISOString(),
    });
});

app.get("/api/v2/dashboard", (req, res) => {
    try {
        const snapshot = pdmStore.dashboardSnapshot();
        res.status(200).json(snapshot);
    } catch (error) {
        console.error("Dashboard fetch error", error);
        res.status(500).json({ message: "Unable to fetch dashboard snapshot" });
    }
});

app.get("/api/v2/assets", (req, res) => {
    try {
        res.status(200).json({ assets: pdmStore.listAssets() });
    } catch (error) {
        console.error("Asset list error", error);
        res.status(500).json({ message: "Unable to fetch assets" });
    }
});

app.post("/api/v2/assets", (req, res) => {
    try {
        const asset = pdmStore.addAsset(req.body || {});
        res.status(201).json({ asset });
    } catch (error) {
        console.error("Asset create error", error);
        res.status(500).json({ message: "Unable to create asset" });
    }
});

app.get("/api/v2/readings", (req, res) => {
    try {
        const assetId = req.query.assetId || null;
        const limit = Number(req.query.limit || 100);
        const readings = pdmStore.listReadings({ assetId, limit });
        res.status(200).json({ readings });
    } catch (error) {
        console.error("Readings fetch error", error);
        res.status(500).json({ message: "Unable to fetch readings" });
    }
});

app.post("/api/v2/readings", (req, res) => {
    try {
        const records = Array.isArray(req.body.records) ? req.body.records : [req.body];
        if (!records.length || !records[0].assetId) {
            return res.status(400).json({ message: "Provide at least one reading with assetId" });
        }
        const result = pdmStore.ingestReadings(records);
        res.status(201).json(result);
    } catch (error) {
        console.error("Reading ingest error", error);
        res.status(500).json({ message: error.message || "Unable to ingest readings" });
    }
});

app.post("/api/v2/readings/simulate", (req, res) => {
    try {
        const result = pdmStore.simulateReadings(req.body || {});
        res.status(201).json(result);
    } catch (error) {
        console.error("Simulation error", error);
        res.status(500).json({ message: "Unable to run simulation" });
    }
});

app.get("/api/v2/alerts", (req, res) => {
    try {
        const status = req.query.status || null;
        const alerts = pdmStore.listAlerts({ status });
        res.status(200).json({ alerts });
    } catch (error) {
        console.error("Alerts fetch error", error);
        res.status(500).json({ message: "Unable to fetch alerts" });
    }
});

app.patch("/api/v2/alerts/:alertId", (req, res) => {
    try {
        const alert = pdmStore.updateAlert(req.params.alertId, req.body || {});
        if (!alert) {
            return res.status(404).json({ message: "Alert not found" });
        }
        res.status(200).json({ alert });
    } catch (error) {
        console.error("Alert update error", error);
        res.status(500).json({ message: "Unable to update alert" });
    }
});
// creating user login and register end points

// Define a schema for the user feedback data
const feedbackSchema = new mongoose.Schema({
    message: String,
    timestamp: { type: Date, default: Date.now }
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Route to handle saving user feedback
app.post('/api/feedback', async (req, res) => {
    const { message } = req.body;

    try {
        // Create a new feedback document and save it to the database
        const feedback = new Feedback({ message });
        await feedback.save();

        res.status(201).json({ message: 'Feedback saved successfully' });
    } catch (err) {
        console.error('Error saving feedback:', err);
        res.status(500).json({ message: 'Error saving feedback' });
    }
});

const User = require("./db/userModel");

// register endpoint
// API endpoint to update user reminders using existing Mongoose connection
app.post('/updateUserReminders', async (req, res) => {
    const { email, reminders } = req.body;

    try {
        const updatedUser = await User.findOneAndUpdate(
            { email },
            { $set: { reminders } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).send('User not found');
        }

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('Error updating user reminders:', error);
        res.status(500).send('Error updating user reminders.');
    }
});

app.post("/register", (request, response) => {
    // hash the password
    bcrypt
        .hash(request.body.password, 10)
        .then((hashedPassword) => {
            // create a new user instance and collect the data
            const user = new User({
                email: request.body.email,
                password: hashedPassword,
                type: request.body.type,
            });

            // save the new user
            user
                .save()
                // return success if the new user is added to the database successfully
                .then((result) => {
                    response.status(201).send({
                        message: "User Created Successfully",
                        result,
                    });
                })
                // catch error if the new user wasn't added successfully to the database
                .catch((error) => {
                    response.status(500).send({
                        message: "Error creating user",
                        error,
                    });
                });
        })
        // catch error if the password hash isn't successful
        .catch((e) => {
            response.status(500).send({
                message: "Password was not hashed successfully",
                e,
            });
        });
});


// login endpoint

app.post("/login", (request, response) => {
    // check if email exists
    User.findOne({ email: request.body.email })

        // if email exists
        .then((user) => {
            // compare the password entered and the hashed password found
            bcrypt
                .compare(request.body.password, user.password)

                // if the passwords match
                .then((passwordCheck) => {

                    // check if password matches
                    if (!passwordCheck) {
                        return response.status(400).send({
                            message: "Passwords does not match"
                        });
                    }

                    //   create JWT token
                    const token = jwt.sign(
                        {
                            userId: user._id,
                            userEmail: user.email,
                        },
                        "RANDOM-TOKEN",
                        { expiresIn: "24h" }
                    );

                    //   return success response
                    response.status(200).send({
                        message: "Login Successful",
                        email: user.email,
                        token,
                    });
                })
                // catch error if password does not match
                .catch((error) => {
                    response.status(400).send({
                        message: "Passwords does not match",
                        error,
                    });
                });
        })
        // catch error if email does not exist
        .catch((e) => {
            response.status(404).send({
                message: "Email not found",
                e,
            });
        });
});

// checking for authorized users only

// authentication endpoint
app.get("/auth-endpoint", auth, (request, response) => {
    response.json({ message: "You are authorized to access me" });
});


// retriving questions

const Question = require("./db/questionModel")

app.get('/questions', async (req, res) => {
    try {
        const questions = await Question.find();
        res.json(questions);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.put('/:email/:language/updateLanguage', async (req, res) => {
    try {
        const { email, language } = req.params;

        const updatedUser = await User.findOneAndUpdate(
            { email },
            { $set: { selected_language: language } }, // Update 'language' to 'English'
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(updatedUser);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
app.put('/:email/:score/updateScore', async (req, res) => {
    try {
        const { email, score } = req.params;

        const updatedUser = await User.findOneAndUpdate(
            { email },
            { $set: { score: score } }, // Update 'language' to 'English'
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(updatedUser);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/:email/language', async (req, res) => {
    try {
        const { email } = req.params;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const language = user.selected_language || 'Default Language'; // Replace 'Default Language' with your default language

        res.json({ email, language });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/:email/getUserData', async (req, res) => {
    const { email } = req.params;
    const user = await User.findOne({ email });

    if (user) {
        res.status(200).send({ score: user.score, selected_language: user.selected_language })
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

app.get('/getAllUsers', async (req, res) => {
    try {
        const { selectedLanguage } = req.params;
        const users = await User.find(
            {}
        );

        res.status(200).send(users);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


module.exports = app;

