require('dotenv').config();
const express = require('express');
//const axios = require('axios');
const bodyParser = require('body-parser');
const { ChatOpenAI } = require('@langchain/openai');
const { ApiPromise, WsProvider } = require('@polkadot/api');

const model = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 0.0,
    apiKey: process.env.OPENAI_API_KEY
});

const app = express();
const port = 3001;

app.use(bodyParser.json());

async function sendTransaction(sender, receiver, amount) {
    const tx = api.tx.balances.transfer(receiver, amount);
    const result = await tx.signAndSend(sender);
    console.log(`Transaction result: ${result}`);
}

async function blockchainMain() {
    const provider = new WsProvider('wss://rpc.astar.network');
    const api = await ApiPromise.create({ provider });

    // Example: Query the latest block number
    const lastHeader = await api.rpc.chain.getHeader();
    console.log(`The latest block number is ${lastHeader.number}`);
}

app.post('/api/gpt', async (req, res) => {
    const userMessage = req.body.message;

    try {
        blockchainMain().catch(console.error);

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
