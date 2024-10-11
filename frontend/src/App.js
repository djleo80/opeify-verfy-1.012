import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Box, Avatar, Paper, Typography, TextField, Button } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import RobotIcon from '@mui/icons-material/Android';
import { web3Enable, web3Accounts, web3FromAddress } from '@polkadot/extension-dapp';
import { ApiPromise, WsProvider } from '@polkadot/api';

// Initialize Polkadot variables
let api = null;
let account = null;
let transactionHistory = [];
let accountInfoStrTemplate = `
    Public Key Polkadot: {pub_key_polk}
    Public Key Substrate: {pub_key_subtrate}
    Balance: {balance}
    Recent Transactions: {recent_transactions}
    Additional Info: {additional_info}
`;
let accountInfoStr = '';
let dest = null;
let amount = null;
let allowDeath = null;

async function initializePolkadot(setAccountInfo) {
    try {
        const extensions = await web3Enable('OpeifyVerfy');
        if (extensions.length === 0) {
            console.log('Please install the Polkadot.js extension.');
            return;
        }

        const accounts = await web3Accounts();
        if (accounts.length === 0) {
            console.log('No accounts found. Please add an account to the Polkadot.js extension.');
            return;
        }

        const provider = new WsProvider('wss://rpc.polkadot.io');
        api = await ApiPromise.create({ provider });
        account = accounts[0];

        const { data: { free: balance } } = await api.query.system.account(account.address);

        accountInfoStr = accountInfoStrTemplate
            .replace('{pub_key_polk}', account.address)
            .replace('{pub_key_subtrate}', account.address)
            .replace('{balance}', balance.toHuman())
            .replace('{additional_info}', '');

        if (transactionHistory.length) {
            const recentTransactions = transactionHistory.length <= 3
                ? transactionHistory
                : transactionHistory.slice(-3);
            accountInfoStr = accountInfoStr.replace('{recent_transactions}', JSON.stringify(recentTransactions));
        }

        setAccountInfo(accountInfoStr);
    } catch (error) {
        console.error('Error initializing Polkadot:', error);
    }
}

async function handleTransaction(setMessages, setPendingTransaction) {
    if (!api || !account) {
        setMessages((prev) => [
            ...prev,
            { sender: 'bot', text: 'Error: API or account not initialized.' },
        ]);
        return;
    }

    try {
        const injector = await web3FromAddress(account.address);

        const transfer = allowDeath
            ? api.tx.balances.transferAllowDeath(dest, amount)
            : api.tx.balances.transfer(dest, amount);

        const hash = await transfer.signAndSend(account.address, { signer: injector.signer });
        transactionHistory.push({ dest, hash: hash.toHex(), amount });

        setMessages((prev) => [
            ...prev,
            { sender: 'bot', text: `Transaction confirmed and sent. <br/> Hash: ${hash.toHex()}.` },
        ]);

        setPendingTransaction(false);
    } catch (error) {
        setMessages((prev) => [
            ...prev,
            { sender: 'bot', text: `Error sending transaction: ${error.message}.` },
        ]);
    }
}

function App() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [accountInfo, setAccountInfo] = useState('');
    const [pendingTransaction, setPendingTransaction] = useState(false);

    useEffect(() => {
        initializePolkadot(setAccountInfo);
    }, []);

    const sendMessage = useCallback(async () => {
        if (!input.trim()) return;

        setMessages((prev) => [...prev, { sender: 'user', text: input }]);
        const responseMessage = await getGPTResponse(input);
        setMessages((prev) => [...prev, responseMessage]);
        setInput('');
    }, [input, getGPTResponse]);

    const getGPTResponse = useCallback(async (input) => {
        if (input === 'CONFIRM' && pendingTransaction) {
            return await handleTransaction(setMessages, setPendingTransaction);
        }

        try {
            const response = await fetch('/api/gpt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: input, accountInfo }),
            });

            const data = await response.json().catch(() => {
                return {
                    sender: 'bot',
                    text: `JSON Parsing Error.<br/>${response.status}: ${response.statusText}`,
                };
            });

            if (data.isTransaction) {
                setPendingTransaction(true);
                dest = data.dest;
                amount = data.amount;
                allowDeath = data.allowDeath;
            }

            return { sender: 'bot', text: data.reply };
        } catch (error) {
            return {
                sender: 'bot',
                text: `Error: ${error.message || 'Unknown Error'}`,
            };
        }
    }, [accountInfo, pendingTransaction]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') sendMessage();
    }, [sendMessage]);

    const memoizedMessages = useMemo(() => (
        messages.map((msg, index) => (
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
                        {msg.sender === 'user' ? 'You' : 'Openify Assistant'}
                    </Typography>
                    <Typography dangerouslySetInnerHTML={{ __html: msg.text }} />
                </Paper>
            </Box>
        ))
    ), [messages]);

    return (
        <Container sx={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'space-between' }}>
            <Box sx={{ flexGrow: 1, padding: 2, overflowY: 'auto' }}>
                {memoizedMessages}
            </Box>
            <Box sx={{ display: 'flex', padding: 2, backgroundColor: '#f8f9fa' }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
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
