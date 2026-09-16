'use strict';
const fs = require('fs');
const path = require('path');

const FIREBASE_CLI_STATE = path.join(process.env.HOME || '', '.config', 'configstore', 'firebase-tools.json');
const PROJECT_ID = 'tahaddi-77a5d';

const readToken = () => {
  const state = JSON.parse(fs.readFileSync(FIREBASE_CLI_STATE, 'utf8'));
  return state.tokens?.access_token;
};

async function main() {
  const accessToken = readToken();
  const ids = require('./ids.json');
  let ok = 0;
  let fail = 0;
  const failures = [];

  // Modest concurrency to avoid overwhelming the REST endpoint.
  const BATCH = 20;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const results = await Promise.all(chunk.map(async (id) => {
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/customQuestions/${id}`;
      const resp = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      return { id, status: resp.status };
    }));
    for (const r of results) {
      if (r.status === 200) ok++;
      else { fail++; failures.push(r); }
    }
    console.log(`Progress: ${Math.min(i + BATCH, ids.length)}/${ids.length}`);
  }

  console.log('Deleted:', ok, 'Failed:', fail);
  if (failures.length) console.log(JSON.stringify(failures.slice(0, 20), null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
