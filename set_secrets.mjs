/**
 * Usage:
 *   GH_PAT=ghp_xxx AWS_ACCESS_KEY_ID=AKIA... AWS_SECRET_ACCESS_KEY=xxx node set_secrets.mjs
 *
 * Requires: npm install libsodium-wrappers (run once in this directory)
 * Install:  npm install libsodium-wrappers
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const REPO = "manoj0456/op_investing_guru";
const PAT = process.env.GH_PAT;
if (!PAT) { console.error("Set GH_PAT env var to your GitHub PAT"); process.exit(1); }

const secrets = {
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
};

for (const [k, v] of Object.entries(secrets)) {
  if (!v) {
    console.error(`Missing env var: ${k}`);
    process.exit(1);
  }
}

async function getPublicKey() {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/secrets/public-key`, {
    headers: { Authorization: `token ${PAT}`, Accept: "application/vnd.github+json" },
  });
  return r.json();
}

async function putSecret(name, encryptedValue, keyId) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/secrets/${name}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${PAT}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ encrypted_value: encryptedValue, key_id: keyId }),
  });
  return r.status;
}

async function run() {
  let sodium;
  try {
    sodium = require("libsodium-wrappers");
    await sodium.ready;
  } catch {
    console.error("Run: npm install libsodium-wrappers  (in this directory first)");
    process.exit(1);
  }

  const { key_id, key } = await getPublicKey();
  const pubKey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);

  for (const [name, value] of Object.entries(secrets)) {
    const messageBytes = sodium.from_string(value);
    const encryptedBytes = sodium.crypto_box_seal(messageBytes, pubKey);
    const encryptedValue = sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);
    const status = await putSecret(name, encryptedValue, key_id);
    console.log(`${name}: HTTP ${status}`);
  }
}

run().catch(console.error);
