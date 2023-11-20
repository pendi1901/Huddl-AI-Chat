const express = require('express');
const nlp = require('compromise');
const OpenAI = require('openai-nodejs');
require('dotenv').config();

const app = express();
const port = 6968;
const connectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
const queueName = process.env.AZURE_QUEUE_NAME;
const client = new OpenAI(process.env.OPENAI_API_KEY);

app.use(express.json());


// sample structure of the request body:
// {
//     "language": "Python",
//     "code": "def add(a, b):\n    return a + b\n",
//     "userText": "How can I optimize this function?",
//     "userLevel": "intermediate",
//     "question": "Optimizing a function",
//     "questionDescription": "I'm looking to make this function run faster and use less memory."
// }


app.post('/solve_problem', (req, res) => {
    const { language, code, userText, userLevel, question, questionDescription } = req.body;
    const intent = analyzeUserIntent(userText);
    const prompt = generateAIPrompt(language, intent, code, userText, userLevel, question, questionDescription);

    client.complete(prompt, { 
        max_tokens: 150, 
        engine: 'davinci',
    })
    .then(completion => {
        res.json({ response: completion.choices[0].text });
    })
    .catch(error => {
        console.error(error);
        res.status(500).send('Error in OpenAI request');
    });
});


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

function generateAIPrompt(language, intent, code, userText, userLevel, question, questionDescription) {
    console.log("Generating AI prompt");
    let prompt = `Language: ${language}\nUser Level: ${userLevel}\n`;
    prompt += `Question: ${question}\nDescription: ${questionDescription}\n`;
    prompt += guideAIResponse(intent, userLevel);
    prompt += `Code:\n${code}\nUser Query: ${userText}\n`;
    return prompt;
}



app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
