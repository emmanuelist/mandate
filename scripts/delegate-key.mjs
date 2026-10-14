// Creates the reference delegate's own key in settings/Delegate-<network>.toml,
// which is gitignored and read only by scripts/delegate.mjs, and records the
// public address in deployments/<network>-delegate.json for the owner to grant.
// The owner's tooling never reads this key, and the delegate never reads the
// owner's seed (#33).
//
// usage: node scripts/delegate-key.mjs <network>
import fs from "node:fs";
import { randomPrivateKey, privateKeyToAddress } from "@stacks/transactions";

const network = process.argv[2] ?? "testnet";
if (!["testnet", "mainnet"].includes(network)) throw new Error(`unknown network ${network}`);
const keyFile = `settings/Delegate-${network}.toml`;
if (fs.existsSync(keyFile)) throw new Error(`${keyFile} already exists: the delegate keeps one key per network`);
const key = randomPrivateKey();
const address = privateKeyToAddress(key, network);
fs.writeFileSync(keyFile, `# The reference delegate's key on ${network}. Never commit, print or share it.\nprivateKey = "${key}"\n`, { mode: 0o600 });
const record = `deployments/${network}-delegate.json`;
const prev = fs.existsSync(record) ? JSON.parse(fs.readFileSync(record, "utf8")) : {};
fs.writeFileSync(record, JSON.stringify({ ...prev, network, delegate: address }, null, 2) + "\n");
console.log(`delegate ${address}\nkey in ${keyFile} (never print it), address in ${record}`);
