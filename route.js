const express = require('express');
const { ServiceBusClient } = require("@azure/service-bus");
require('dotenv').config();
const db = require('./database.js')
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 6969;

const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
const queueName = process.env.AZURE_QUEUE_NAME;

app.use(express.json());

app.post('/solve_problem', async (req, res) => {
    const requestId = uuidv4();
    const userId = req.body.userId;
    const requestData = {

        requestId,
        userId: req.body.userId,
        language: req.body.language,
        code: req.body.code,
        userText: req.body.userText,
        userLevel: req.body.userLevel,
        question: req.body.question,
        questionDescription: req.body.questionDescription
    };


    const query = "INSERT INTO responses (requestId, userId, response, status) VALUES (?, ?, ?, 'in_progress')";
    db.query(query, [requestId, userId, '', 'in_progress'], (err, results) => {
        if (err) {
            res.status(500).send(err.message);
        } else {
            res.json({ requestId, userId });
        }
    });


    await enqueueRequest(requestData);
    // res.json({ requestId });
});

app.get('/get_response/:requestId', (req, res) => {
    const requestId = req.params.requestId;
    const query = "SELECT status, response FROM responses WHERE requestId = ?";

    db.query(query, [requestId], (err, results) => {
        if (err) {
            res.status(500).send(err.message);
        } else {
            if (results.length > 0) {
                const status = results[0].status;
                const response = results[0].response;

                if (status === 'completed') {
                    res.status(200).json({ message: response });
                    // Optional: Remove the response after it's retrieved
                } else if (status === 'in_progress') {
                    res.status(300).json({ message: "Response not ready" });
                } else if (status === 'error') {
                    res.status(500).json({ message: "Error processing request" });
                }
            } else {
                res.status(404).json({ message: "Response not found" });
            }
        }
    });
});


async function enqueueRequest(requestData) {
    const sbClient = new ServiceBusClient(connectionString);
    const sender = sbClient.createSender(queueName);

    try {
        await sender.sendMessages({ body: JSON.stringify(requestData) });
        console.log("Enqueued request:", requestData);
    } finally {
        await sender.close();
    }
}

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
