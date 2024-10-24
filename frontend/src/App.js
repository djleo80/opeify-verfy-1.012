import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Box, Avatar, Paper, Typography, TextField, Button } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import RobotIcon from '@mui/icons-material/Android';
import { web3Enable, web3Accounts, web3FromAddress } from '@polkadot/extension-dapp';
import { ApiPromise, WsProvider } from '@polkadot/api';

// Initialize Polkadot variables
let api = null;

const accountInfoStrTemplate = `
    Public Key Polkadot: {pub_key_polk}
    Public Key Substrate: {pub_key_subtrate}
    Balance: {balance}
    Recent Transactions: {recent_transactions}
    Additional Info: {additional_info}
`;

async function initializePolkadot(setAccountInfo, setAccount, setTransactionHistory) {
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
        const account = accounts[0];

        const { data: { free: balance } } = await api.query.system.account(account.address);

        let accountInfoStr = accountInfoStrTemplate
            .replace('{pub_key_polk}', account.address)
            .replace('{pub_key_subtrate}', account.address)
            .replace('{balance}', balance.toHuman())
            .replace('{additional_info}', '');

        setAccount(account);
        setAccountInfo(accountInfoStr);

    } catch (error) {
        console.error('Error initializing Polkadot:', error);
    }
}

async function handleTransaction({ api, account, transactionDetails, setMessages, setPendingTransaction, setTransactionHistory }) {
    if (!api || !account) {
        setMessages((prev) => [
            ...prev,
            { sender: 'bot', text: 'Error: API or account not initialized.' },
        ]);
        return;
    }

    const { dest, amount, allowDeath } = transactionDetails;

    try {
        const injector = await web3FromAddress(account.address);

        const transfer = allowDeath
            ? api.tx.balances.transferAllowDeath(dest, amount)
            : api.tx.balances.transfer(dest, amount);

        const hash =

