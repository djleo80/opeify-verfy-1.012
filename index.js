const { ApiPromise, WsProvider } = require('@polkadot/api');

async function connect() {
  const wsProvider = new WsProvider('wss://rpc.astar.network');
  const api = await ApiPromise.create({ provider: wsProvider });

  // Verify file hash
  async function verifyFileHash(fileHash) {
    const result = await api.query.fileVerification.verifiedFiles(fileHash);
    const verified = result.isSome;
    console.log(`File Hash: ${fileHash}`);
    console.log(`Verified: ${verified}`);
  }

  // Call the verifyFileHash function with your file hash
  verifyFileHash('your_file_hash_here');

  await api.disconnect();
}

connect().catch(console.error);