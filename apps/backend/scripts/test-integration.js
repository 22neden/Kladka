const {spawnSync}=require('node:child_process');
const result=spawnSync(process.execPath,['--test','tests/api.test.js'],{stdio:'inherit',env:{...process.env,KLADKA_REAL_MONGO:'1'}});
process.exit(result.status??1);
