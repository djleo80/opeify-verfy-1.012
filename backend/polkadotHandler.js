const { ApiPromise, WsProvider } = require('@polkadot/api');

let api;

async function initBlockchainConnection() {
    if (!api) {
        const provider = new WsProvider('wss://rpc.astar.network');
        api = await ApiPromise.create({ provider });
    }
}

async function sendTransaction(sender, receiver, amount) {
    await initBlockchainConnection();
    const tx = api.tx.balances.transfer(receiver, amount);
    const result = await tx.signAndSend(sender);
    console.log(`Transaction result: ${result}`);
}

module.exports = { initBlockchainConnection, sendTransaction };
