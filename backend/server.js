require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { ChatOpenAI } = require('@langchain/openai');
const { sendTransaction } = require('./blockchainHandler');

const promptTemp = 0.0, generateTemp = 0.7

const promptModel = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: promptTemp,
    apiKey: process.env.OPENAI_API_KEY
});

const generateModel = new ChatOpenAI({
    model: "gpt-3.5-turbo",
    temperature: generateTemp,
    apiKey: process.env.OPENAI_API_KEY
});

const app = express();
const port = 3001;

const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // Limit each IP to 100 requests per window
});

const morgan = require('morgan');

app.use(bodyParser.json());
app.use(limiter);
app.use(morgan('combined'));

const templateMainPrompt = `
Given the user query delimited by <tag>, match it to the cloest category from the list of six categories below, then follow the given instructions for that specific category. 
Only output in the format specified for each category. Always start your response with [. Do not put in \`\`\`.

- Category: Request Transaction
- Description: User query is asking for a transaction to be made to another account
- Output: Json snippet in the following schema delimited by \`\`\`. 
 
\`\`\`
[
    {
        "type": "transaction",
        "amount": number, // Amount of Polkadot to transfer. If not provided, put 0. 
        "dest": string, // A string of the destination cryptocurrency wallet address. If not provided. put '0'.
        "allowDeath": boolean // If the transfer should wipe the account. If not provided, default to false.
    }
]
\`\`\`
 
- Category: Account Details
- Description: User query is asking for specific details related to their account
- Output: Json snippet in the following schema delimited by \`\`\`. 
 
\`\`\`
[
    {
        "type": "account",
        "query": string // User query
    }
]
\`\`\`
 
- Category: Blockchain Knowledge
- Description: User query is asking for knowledge related to Web3, Blockchain or Cryptocurrency
- Output: Json snippet in the following schema delimited by \`\`\`.
 
\`\`\`
[
    {
        "type": "blockchains",
        "query": string // User query
    }
]
\`\`\`
 
- Category: Smart Contract Generation
- Description: User query is generating smart contract
- Output: Json snippet in the following schema delimited by \`\`\`.
 
\`\`\`
[
    {
        "type": "smart_contract",
        "query": string // User query
    }
]
\`\`\`
 
- Category: General
- Description: Any general query that does not fall into one of the categories above
- Output:  Json snippet in the following schema delimited by \`\`\`.
 
\`\`\`
[
    {
        "type": "general",
        "info": string // Answer the query in less than 50 words
    }
]
\`\`\`

<tag>{user_input}</tag>
`;

const templateAccountEnquiry = `
Given the following user account information enclosed by \`\`\`, answer the user enquiry delimited by <tag>.

\`\`\`{account_info}\`\`\`

<tag>{user_enquiry}</tag>
`;

const blockchainPrompt = `
You are a very smart Blockchains expert, and especially an expert in the Polkadot ecosystem. You are so good because you are able to explain difficulty concepts with relatively straightforward examples. \
When answering questions, you should also make references to relevant knowledge inside Polkadot ecosystem, and try to introduce the user to the amazing world of Web3 for Economics with Polkadot. 

Here is a question:
{query}
`

const smartContractPrompt = `
You are a very good smart contract maker, and especially an expert in the Polkadot ecosystem. \
With the following request delimited by <tag>, generate a smart contract and output it as your response. 
<tag>{query}</tag>
`

async function handlePrompt(user_input) {
    const promptText = templateMainPrompt.replace('{user_input}', user_input);
 
    const response = await promptModel.invoke(promptText);
 
    try {
        if (String(response.content).startsWith('```') && String(response.content).endsWith('```')) {
            return JSON.parse(String(response.content).slice(3, -3))[0];
        }
        if (JSON.parse(String(response.content))[0]) {
            return JSON.parse(String(response.content))[0];
        }
        return JSON.parse(String(response.content));
    } catch (error) {
        console.error(`[CRITICAL] Error handling initial prompt: `, error);
        console.log(response.content);
        return {};
    }
}

app.post('/api/gpt', async (req, res) => {
    const { message: userMessage, accountInfo: accountInfoStr } = req.body;

    if (!userMessage || typeof userMessage !== 'string') {
        return res.status(400).json({ error: 'Invalid user message' });
    }

    if (accountInfoStr && typeof accountInfoStr !== 'string') {
        return res.status(400).json({ error: 'Invalid account info' });
    }

    try {
        //blockchainMain().catch(console.error);

        const gptMessage = await handlePrompt(userMessage);
        //console.log(gptMessage);

        if (gptMessage.type == 'general') {
            //console.log(`Human: ${userMessage}\nGPT (general): ${gptMessage.info}`);
            res.json({ reply: gptMessage.info, isTransaction: false });
        }
        else if (gptMessage.type == 'transaction') {
            //console.log("Transaction");
            const reply = `Amount: <code>${gptMessage.amount}</code> $DOT<br/>Destination: <code>${gptMessage.dest}</code>${gptMessage.allowDeath ? "Allow Death: True<br/>" : ""}<br/>Please confirm by sending <b>CONFIRM</b>.`;
            //console.log(`Human: ${userMessage}\nGPT (transaction): ${reply}`);
            res.json({ reply: reply, isTransaction: true, amount: gptMessage.amount, dest: gptMessage.dest, allowDeath: true });
        }
        else if (gptMessage.type == 'account') {
            const promptText = templateAccountEnquiry.replace('{account_info}', accountInfoStr).replace('{user_enquiry}', gptMessage.query);
            const response = await generateModel.invoke(promptText);
            res.json({ reply: response.content, isAccount: true });
        }
        else if (gptMessage.type == 'blockchains') {
            const promptText = blockchainPrompt.replace('{query}', gptMessage.query);
            const response = await generateModel.invoke(promptText);
            res.json({ reply: response.content, isTransaction: false });
        }
        else if (gptMessage.type == 'smart_contract') {
            const promptText = smartContractPrompt.replace('{query}', gptMessage.query);
            const response = await generateModel.invoke(promptText);
            res.json({ reply: response.content, isTransaction: false });
        }
        else {
            res.json({ reply: `Unable to process machine response.\n${gptMessage.content}`, isTransaction: false });
        }
    } catch (error) {
        res.status(500).send('Error communicating with GPT API');
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
