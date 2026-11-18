const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const result=spawnSync(process.execPath,[path.join(root,'apps/frontend/node_modules/expo/bin/cli'),'export','--platform','web','--output-dir','dist-api'],{cwd:path.join(root,'apps/frontend'),stdio:'inherit',env:{...process.env,EXPO_PUBLIC_API_URL:'http://127.0.0.1:3099',EXPO_PUBLIC_TERMS_URL:'https://example.test/terms'}});
if(result.status!==0)process.exit(result.status??1);
const test=spawnSync(process.execPath,[path.join(root,'scripts/remote-smoke.cjs')],{cwd:root,stdio:'inherit'});process.exit(test.status??1);
