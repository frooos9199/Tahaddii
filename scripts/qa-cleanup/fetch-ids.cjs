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
  const ids = [];
  let pageToken = null;
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/customQuestions`);
    url.searchParams.set('pageSize', '300');
    url.searchParams.set('mask.fieldPaths', 'categoryId');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
    const body = await resp.json();
    for (const doc of body.documents || []) {
      ids.push(doc.name.split('/').pop());
    }
    pageToken = body.nextPageToken || null;
  } while (pageToken);
  fs.writeFileSync(path.join(__dirname, 'ids.json'), JSON.stringify(ids, null, 2));
  console.log('Total docs currently in customQuestions:', ids.length);
}
main().catch(e => { console.error(e); process.exit(1); });
