import React, { useState, useEffect } from 'react';
import { Container, Box, TextField, Button, Typography, Paper, Avatar } from '@mui/material';
import RobotIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';

import { ApiPromise, WsProvider } from '@polkadot/api';
import { web3Enable, web3Accounts, web3FromAddress } from '@polkadot/extension-dapp';

let pendingTransaction = false;
let api;
let account;
let amount, dest, allowDeath;
let accountInfoStr = '';

const transactionHistory = [];

const accountInfoStrTemplate = `
User Account Information:
Public Key Address (Polkadot Mainnet): {pub_key_polk}
Public Key Address (Subtrate Format): {pub_key_subtrate}
Account Balance: {balance}
{recent_transactions}
{additional_info}
`

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
    api = await ApiPromise.create({ provider });

    // Use the first account for transactions
    account = accounts[0];


    const { data: { free: balance } } = await api.query.system.account(account.address);
    console.log(`Balance of ${account.address}: ${balance.toHuman()}`);
    accountInfoStr = accountInfoStrTemplate
        .replace('{pub_key_polk}', account.address)
        .replace('{pub_key_subtrate}', account.address)
        .replace('{balance}', balance.toHuman())
        .replace('{additional_info}', '');
    if (transactionHistory.length) {
        const recentTransactions = transactionHistory.length <= 3 : transactionHistory : transactionHistory.slice(-3, 0);
        accountInfoStr = accountInfoStr.replace('{recent_transactions}', JSON.stringify(recentTransactions));
    }
}

async function handleTransaction(dest, amount, allowDeath) {
    if (!api || !account) {
        console.log('API or account not initialized.');
        return { sender: 'bot', text: 'Error: API or account not initialized.' };
    }

    try {
        const injector = await web3FromAddress(account.address);

        const transfer = allowDeath ? api.tx.balances.transferAllowDeath(dest, amount) : api.tx.balances.transfer(dest, amount);

        const hash = await transfer.signAndSend(account.address, { signer: injector.signer });
        console.log('Transaction sent with hash:', hash.toHex());
        transactionHistory.push({ dest, hash: hash.toHex(), amount });
        return { sender: 'bot', text: `Transaction confirmed and sent. <br/> Hash: ${hash.toHex()}.` };
    } catch (error) {
        console.log('Error sending transaction:', error);
        return { sender: 'bot', text: `Error sending transaction: ${error}.<br/> You may specify to allow death when prompting the transfer.` };
    }
}

function App() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');

    useEffect(() => {
        initializePolkadot();
    }, []);

    const sendMessage = async () => {
        if (input.trim() === '') return;

        const userMessage = { sender: 'user', text: input };
        setMessages([...messages, userMessage]);

        const responseMessage = await getGPTResponse(input);
        setMessages([...messages, userMessage, responseMessage]);

        setInput('');
    };

    const getGPTResponse = async (input) => {
        if (input === 'CONFIRM' && pendingTransaction) {
            pendingTransaction = false;

            return await handleTransaction(dest, amount, allowDeath);
        }

        const response = await fetch('/api/gpt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: input, accountInfo: accountInfoStr })
        });
        const data = await response.json();
        if (data.isTransaction) {
            pendingTransaction = true;
            dest = data.dest;
            amount = data.amount;
            allowDeath = data.allowDeath;
        }
        return { sender: 'bot', text: data.reply };
    };

    return (
        <Container sx={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'space-between' }}>
            <Box sx={{ flexGrow: 1, padding: 2, overflowY: 'auto' }}>
                {messages.map((msg, index) => (
                    <Box
                        key={index}
                        sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            marginY: 1,
                            gap: 1,
                            justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                        }}
                    >
                        <Avatar
                            sx={{
                                bgcolor: msg.sender === 'user' ? '#007bff' : '#e9ecef',
                                color: msg.sender === 'user' ? 'white' : 'black',
                            }}
                        >
                            {msg.sender === 'user' ? <PersonIcon /> : <RobotIcon />}
                        </Avatar>
                        <Paper
                            sx={{
                                padding: 2,
                                borderRadius: 1,
                                backgroundColor: msg.sender === 'user' ? '#007bff' : '#e9ecef',
                                color: msg.sender === 'user' ? 'white' : 'black',
                                maxWidth: '75%',
                            }}
                        >
                            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                                {msg.sender === 'user' ? msg.sender : 'Openify Assistant'}
                            </Typography>
                            <Typography
                                dangerouslySetInnerHTML={{ __html: msg.text }}
                            />
                        </Paper>
                    </Box>
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
