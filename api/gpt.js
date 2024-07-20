// api/gpt.js

require('dotenv').config();
const { ChatOpenAI } = require('@langchain/openai');
const { ApiPromise, WsProvider } = require('@polkadot/api');

const model = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: 0.0,
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize blockchain API
let blockchainApi;
async function getBlockchainApi() {
    if (!blockchainApi) {
        const provider = new WsProvider('wss://rpc.astar.network');
        blockchainApi = await ApiPromise.create({ provider });
    }
    return blockchainApi;
}

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const userMessage = req.body.message;

        try {
            const api = await getBlockchainApi();
            
            // Example: Query the latest block number (for debugging)
            const lastHeader = await api.rpc.chain.getHeader();
            console.log(`The latest block number is ${lastHeader.number}`);

            // Get GPT response
            const gptMessage = await model.invoke(userMessage);
            console.log(`Human: ${userMessage}\nGPT: ${gptMessage.content}`);
            res.status(200).json({ reply: gptMessage.content });
        } catch (error) {
            console.error('Error:', error);
            res.status(500).send('Error communicating with GPT API');
        }
    } else {
        // Handle any other HTTP method
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
