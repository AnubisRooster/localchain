// ─────────────────────────────────────────────────────────────
// LocalChain – Transaction Broadcast Service
// Signs and broadcasts transactions via CosmJS (REST/gRPC)
// instead of shelling out to the localchaind CLI.
// ─────────────────────────────────────────────────────────────
const { SigningStargateClient } = require("@cosmjs/stargate");
const { DirectSecp256k1HdWallet, DirectSecp256k1Wallet, Registry } = require("@cosmjs/proto-signing");
const { execFile } = require("child_process");
const protobuf = require("protobufjs");
const config = require("../../shared/config");
const { getNodeById } = require("./registry");
const { selectNode } = require("./node-selector");

const MSG_TYPE_URL = "/localchain.records.v1.MsgCreateRecord";

let signerClient = null;
let signerAddress = null;
let initPromise = null;

function buildRpcUrl(node) {
  if (node) {
    return `http://${node.public_endpoint || node.host}:${node.rpc_port || 26657}`;
  }
  return config.tendermintRpc;
}

function extractPrivateKeyFromKeyring() {
  return new Promise((resolve, reject) => {
    const args = [
      "keys", "export", config.signerKey,
      "--keyring-backend", config.keyringBackend,
      "--home", config.chainHome,
      "--unarmored-hex", "--unsafe", "--yes",
    ];

    execFile(config.chainBinary, args, { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      const key = stdout.trim();
      if (key.length === 64) {
        resolve({ privateKeyHex: key });
      } else {
        reject(new Error("Unexpected key format"));
      }
    });
  });
}

async function getSignerCredentials() {
  if (process.env.SIGNER_MNEMONIC) {
    return { mnemonic: process.env.SIGNER_MNEMONIC };
  }

  if (process.env.SIGNER_PRIVATE_KEY) {
    return { privateKeyHex: process.env.SIGNER_PRIVATE_KEY };
  }

  try {
    return await extractPrivateKeyFromKeyring();
  } catch {
    return null;
  }
}

function createMsgCreateRecordType() {
  const MsgCreateRecord = new protobuf.Type("MsgCreateRecord")
    .add(new protobuf.Field("creator", 1, "string"))
    .add(new protobuf.Field("data", 2, "string"));

  const MsgCreateRecordResponse = new protobuf.Type("MsgCreateRecordResponse");

  return { MsgCreateRecord, MsgCreateRecordResponse };
}

function createCustomRegistry() {
  const registry = new Registry();
  const { MsgCreateRecord, MsgCreateRecordResponse } = createMsgCreateRecordType();

  registry.register(MSG_TYPE_URL, MsgCreateRecord);
  registry.register("/localchain.records.v1.MsgCreateRecordResponse", MsgCreateRecordResponse);

  return registry;
}

async function createSigner(credentials) {
  const prefix = "cosmos";

  if (credentials.mnemonic) {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(credentials.mnemonic, { prefix });
    const [account] = await wallet.getAccounts();
    return { signer: wallet, address: account.address };
  }

  if (credentials.privateKeyHex) {
    const privateKey = Buffer.from(credentials.privateKeyHex, "hex");
    const wallet = await DirectSecp256k1Wallet.fromKey(privateKey, prefix);
    const [account] = await wallet.getAccounts();
    return { signer: wallet, address: account.address };
  }

  throw new Error("No valid signer credentials provided");
}

async function initClient(nodeId) {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const credentials = await getSignerCredentials();
    if (!credentials) {
      throw new Error("Failed to load signer credentials. Set SIGNER_MNEMONIC or ensure keyring is accessible.");
    }

    const { signer, address } = await createSigner(credentials);
    signerAddress = address;

    const node = nodeId ? getNodeById(nodeId) : selectNode();
    const rpcUrl = buildRpcUrl(node);

    const registry = createCustomRegistry();
    signerClient = await SigningStargateClient.connectWithSigner(rpcUrl, signer, { registry });
    return { client: signerClient, address: signerAddress };
  })();

  return initPromise;
}

async function broadcastRecord(recordData, nodeId) {
  await initClient(nodeId);

  const msg = {
    typeUrl: MSG_TYPE_URL,
    value: {
      creator: signerAddress,
      data: typeof recordData === "string" ? recordData : JSON.stringify(recordData),
    },
  };

  const fee = {
    amount: [{ denom: "stake", amount: "2000" }],
    gas: "200000",
  };

  const memo = "localchain-dashboard";

  const result = await signerClient.signAndBroadcast(signerAddress, [msg], fee, memo);

  return {
    txhash: result.transactionHash,
    height: parseInt(result.height, 10),
    code: result.code,
    raw_log: result.rawLog || "",
  };
}

function resetClient() {
  signerClient = null;
  signerAddress = null;
  initPromise = null;
}

function getSignerAddress() {
  return signerAddress;
}

module.exports = {
  broadcastRecord,
  resetClient,
  getSignerAddress,
  initClient,
  MSG_TYPE_URL,
};
