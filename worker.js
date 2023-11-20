const { ServiceBusClient } = require("@azure/service-bus");
const axios = require('axios');
const nlp = require('compromise');
const db = require('./database.js')
require('dotenv').config();


const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
const queueName = process.env.AZURE_QUEUE_NAME;
const ollamaEndpoint = 'http://localhost:11434/api/generate'; // Ollama API endpoint

async function processRequests() {
    const sbClient = new ServiceBusClient(connectionString);
    const receiver = sbClient.createReceiver(queueName);

    receiver.subscribe({
        processMessage: async (message) => {
            try {
                console.log("Received message:", message.body);
                const requestData = JSON.parse(message.body);

                const ollamaPrompt = generateOllamaPrompt(requestData);
                const response = await axios.post(ollamaEndpoint, {
                    model: "orca-mini",
                    prompt: ollamaPrompt
                });

                console.log(response)
                console.log(response.data)


                console.log("Response from Ollama:", response.data);
                // TODO: Handle the response

                const responses={};
                const fullResponse = handleOllamaResponse(response.data);
                // console.log("Full response:", fullResponse);
                responses[requestData.requestId] = fullResponse;
                const updateQuery = "UPDATE responses SET response = ?, status = ? WHERE requestId = ?";
                db.query(updateQuery, [fullResponse, 'completed', requestData.requestId, requestData.userId], (err, results) => {
                if (err) {
                    console.error("Error updating database:", err);
                } else {
                    console.log("Response updated in database for requestId:", requestData.requestId);
                }
        });

                

                await receiver.completeMessage(message);
            } catch (error) {
                console.error("Error processing request:", error);
                // Handle error
            }
        },
        processError: async (args) => {
            console.error(`Error occurred: ${args.error}`);
        }
    });

    console.log(`Worker running and waiting for messages in ${queueName}`);
}

processRequests();

function analyzeUserIntent(userText) {
    console.log("Analyzing user intent");
    let doc = nlp(userText);
    if (doc.has('(fix|error|bug|issue|problem)')) return 'debugging';
    if (doc.has('(optimize|improve|performance|efficient|faster)')) return 'optimization';
    if (doc.has('(explain|understand|how does|what is|meaning|concept|learn)')) return 'learning';
    if (doc.has('(review|feedback|good|bad|better|code review)')) return 'code review';
    return 'general';
}

function guideAIResponse(intent, userLevel) {
    console.log("Guiding AI response");
    const guides = {
        'debugging': {
            'beginner': "Identify errors in the code and explain the fixes in simple terms.",
            'intermediate': "Point out the bugs and suggest fixes with some advanced concepts.",
            'advanced': "Provide detailed debugging insights using advanced techniques."
        },
        'optimization': {
            'beginner': "Suggest basic optimization techniques and explain their benefits simply.",
            'intermediate': "Recommend more complex optimizations and their impact on performance.",
            'advanced': "Discuss high-level optimization strategies in depth."
        },
        'code review': {
            'beginner': "Provide a simple code review focusing on basic coding principles.",
            'intermediate': "Offer a detailed code review, including some intermediate best practices.",
            'advanced': "Conduct an in-depth code analysis with a focus on advanced techniques."
        },
        'learning': {
            'beginner': "Explain the concept in straightforward, easy-to-understand terms.",
            'intermediate': "Provide a more detailed explanation including intermediate concepts.",
            'advanced': "Delve into complex details and technical nuances of the concept."
        },
        'general': "Assist the user with their query in a helpful and informative manner."
    };

    return intent in guides ? guides[intent][userLevel] + "\n" : guides['general'] + "\n";
}

function generateOllamaPrompt(requestData) {
    console.log("Generating AI prompt");
    const intent = analyzeUserIntent(requestData.userText);
    let prompt = `Language: ${requestData.language}\nUser Level: ${requestData.userLevel}\n`;
    prompt += `Question: ${requestData.question}\nDescription: ${requestData.questionDescription}\n`;
    prompt += guideAIResponse(intent, requestData.userLevel);
    prompt += `Code:\n${requestData.code}\nUser Query: ${requestData.userText}\n`;
    return prompt;
}


function handleOllamaResponse(responseData) {
    let fullResponse = '';
    
    // Split the responseData into individual JSON strings
    const responseObjects = responseData.split('}').map(str => str.trim() + '}');

    responseObjects.forEach(responseStr => {
        try {
            if (responseStr.trim() !== '}') {  // Avoid empty strings after splitting
                const responseObj = JSON.parse(responseStr);
                fullResponse += responseObj.response;
            }
        } catch (e) {
            console.error("Error parsing response object:", responseStr, e);
        }
    });

    return fullResponse;
}
