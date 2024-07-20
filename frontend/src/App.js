import React, { useState } from 'react';
import { Container, Box, TextField, Button, Typography, Paper } from '@mui/material';

import { ApiPromise, WsProvider } from '@polkadot/api';
import { web3Enable, web3Accounts, web3FromAddress } from '@polkadot/extension-dapp';


// Example of querying the chain
/*const chainName = await api.rpc.system.chain();
console.log(`Connected to ${chainName}`);

// Example of interacting with a smart contract
//const contractAddress = '0x...'; // Replace with your contract address
//const contract = await api.query.contracts.getContract(contractAddress);

// Call a function on the contract
//const result = await contract.methodName(params);
//console.log(result.toHuman());*/


async function initializePolkadot() {
    // Check if the Polkadot.js extension is installed
    const extensions = await web3Enable('OpeifyVerfy');

    if (extensions.length === 0) {
        console.log('Please install the Polkadot.js extension.');
        return;
    }

    // Get all accounts
    const accounts = await web3Accounts();

    if (accounts.length === 0) {
        console.log('No accounts found. Please add an account to the Polkadot.js extension.');
        return;
    }

    // Connect to the Polkadot network
    const provider = new WsProvider('wss://rpc.polkadot.io'); // Use appropriate RPC endpoint
    const api = await ApiPromise.create({ provider });

    // Use the first account for transactions
    const account = accounts[0];
    const injector = await web3FromAddress(account.address);

    // Example: Checking balance
    const { data: { free: balance } } = await api.query.system.account(account.address);
    console.log(`Balance of ${account.address}: ${balance.toHuman()}`);
}

function App() {
    initializePolkadot();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');

    const sendMessage = async () => {
        if (input.trim() === '') return;

        const userMessage = { sender: 'user', text: input };
        setMessages([...messages, userMessage]);

        // Send request to GPT API here
        const responseMessage = await getGPTResponse(input);
        setMessages([...messages, userMessage, responseMessage]);

        setInput('');
    };

    const getGPTResponse = async (input) => {
        const response = await fetch('/api/gpt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: input })
        });
        const data = await response.json();
        return { sender: 'bot', text: data.reply };
    };

    return (
        <Container sx={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'space-between' }}>
            <Box sx={{ flexGrow: 1, padding: 2, overflowY: 'auto' }}>
                {messages.map((msg, index) => (
                <Paper
                    key={index}
                    sx={{
                    padding: 2,
                    marginY: 1,
                    borderRadius: 1,
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    backgroundColor: msg.sender === 'user' ? '#007bff' : '#e9ecef',
                    color: msg.sender === 'user' ? 'white' : 'black',
                    }}
                >
                    <Typography>{msg.text}</Typography>
                </Paper>
                ))}
            </Box>
            <Box sx={{ display: 'flex', padding: 2, backgroundColor: '#f8f9fa' }}>
                <TextField
                fullWidth
                variant="outlined"
                size="small"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                sx={{ marginRight: 2 }}
                />
                <Button variant="contained" onClick={sendMessage}>
                Send
                </Button>
            </Box>
        </Container>
    );
}

export default App;
