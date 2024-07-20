require('dotenv').config();
const express = require('express');
//const axios = require('axios');
const bodyParser = require('body-parser');
const { ChatOpenAI } = require('@langchain/openai');

const model = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 0.0,
    apiKey: process.env.OPENAI_API_KEY
});

const app = express();
const port = 3001;

app.use(bodyParser.json());

app.post('/api/gpt', async (req, res) => {
    const userMessage = req.body.message;

    try {
        /*const response = await axios.post(
        'https://api.openai.com/v1/engines/davinci-codex/completions',
        {
            prompt: userMessage,
            max_tokens: 150,
        },
        {
            headers: {
            'Authorization': `Bearer YOUR_OPENAI_API_KEY`
            }
        }
        );*/

        //const gptMessage = response.data.choices[0].text.trim();
        const gptMessage = await model.invoke(userMessage);
        console.log(`Human: ${userMessage}\nGPT: ${gptMessage.content}`);
        res.json({ reply: gptMessage.content });
    } catch (error) {
        res.status(500).send('Error communicating with GPT API');
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
