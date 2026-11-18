// Test-only repository for HTTP contract tests. This is NOT a MongoDB substitute
// in the application and does not prove transaction/index behavior in Atlas.
const {Query,Aggregator}=require('mingo');
const mongoose=require('mongoose');
const models=require('../src/models');
function installMemoryRepository(){
 const stores=new Map();for(const M of Object.values(models))stores.set(M,new Map());
 const copy=v=>structuredClone(v);
 const matches=(doc,query)=>new Query(query).test(doc);
 function makeQuery(M,fn){
  let sort,limit,lean=false;
  const q={sort(v){sort=v;return q;},limit(v){limit=v;return q;},lean(){lean=true;return q;},select(){return q;},session(){return q;},then(resolve,reject){return Promise.resolve().then(()=>{
   let data=fn();if(Array.isArray(data)){if(sort){const [key,dir]=Object.entries(sort)[0];data.sort((a,b)=>a[key]<b[key]?-dir:a[key]>b[key]?dir:0);}if(limit)data=data.slice(0,limit);return data.map(x=>lean?copy(x):hydrate(M,x));}return data?lean?copy(data):hydrate(M,data):null;
  }).then(resolve,reject);}};return q;
 }
 function checkUnique(M,value){for(const [keys,options] of M.schema.indexes()){if(!options.unique)continue;if(options.partialFilterExpression&&!matches(value,options.partialFilterExpression))continue;for(const row of stores.get(M).values()){if(row._id!==value._id&&Object.keys(keys).every(k=>row[k]===value[k])){const e=new Error('duplicate key');e.code=11000;throw e;}}}}
 function persist(M,doc){const obj=doc.toObject();checkUnique(M,obj);stores.get(M).set(obj._id,obj);return doc;}
 function hydrate(M,obj){const doc=new M(copy(obj));doc.save=async()=>persist(M,doc);return doc;}
 function updateDoc(doc,update,insert){for(const [k,v] of Object.entries(update.$set||{}))doc.set(k,v);if(insert)for(const [k,v]of Object.entries(update.$setOnInsert||{}))doc.set(k,v);for(const [k,v] of Object.entries(update.$inc||{}))doc.set(k,(doc.get(k)||0)+v);for(const [k,v] of Object.entries(update.$max||{}))if(!doc.get(k)||doc.get(k)<v)doc.set(k,v);}
 for(const M of Object.values(models)){
  const store=stores.get(M),rows=query=>[...store.values()].filter(row=>matches(row,query||{}));
  M.init=async()=>M;
  M.find=query=>makeQuery(M,()=>rows(query));
  M.findOne=query=>makeQuery(M,()=>rows(query)[0]);M.findById=id=>M.findOne({_id:id});
  M.exists=async query=>{const r=rows(query)[0];return r?{_id:r._id}:null;};
  M.countDocuments=async query=>rows(query).length;
  M.create=async data=>Array.isArray(data)?Promise.all(data.map(d=>M.create(d))):persist(M,new M(data));
  M.findOneAndUpdate=(query,update,options={})=>makeQuery(M,()=>{let row=rows(query)[0];const insert=!row;if(!row&&!options.upsert)return null;const doc=hydrate(M,row||Object.fromEntries(Object.entries(query).filter(([,v])=>typeof v!=='object')));updateDoc(doc,update,insert);persist(M,doc);return options.new?doc.toObject():row;});
  M.findByIdAndUpdate=(id,update,options)=>M.findOneAndUpdate({_id:id},update,options);
  M.updateOne=async(query,update,options={})=>{const row=rows(query)[0];if(!row&&!options.upsert)return{matchedCount:0,modifiedCount:0};const doc=hydrate(M,row||Object.fromEntries(Object.entries(query).filter(([,v])=>typeof v!=='object')));updateDoc(doc,update,!row);persist(M,doc);return{matchedCount:row?1:0,modifiedCount:1};};
  M.updateMany=async(query,update)=>{const selected=rows(query);for(const row of selected){const doc=hydrate(M,row);updateDoc(doc,update,false);persist(M,doc);}return{matchedCount:selected.length,modifiedCount:selected.length};};
  M.deleteOne=async query=>{const row=rows(query)[0];if(row)store.delete(row._id);return{deletedCount:row?1:0};};
  M.deleteMany=async query=>{const r=rows(query);r.forEach(row=>store.delete(row._id));return{deletedCount:r.length};};
  M.findOneAndDelete=query=>makeQuery(M,()=>{const row=rows(query)[0];if(row)store.delete(row._id);return row;});
  M.aggregate=async pipeline=>new Aggregator(pipeline).run([...store.values()]);
 }
 mongoose.connection.transaction=async fn=>{const snapshots=[...stores].map(([M,s])=>[M,new Map([...s].map(([k,v])=>[k,copy(v)]))]);try{return await fn({});}catch(e){for(const [M,s]of snapshots){stores.get(M).clear();for(const [k,v]of s)stores.get(M).set(k,v);}throw e;}};
 return {close:async()=>{}};
}
module.exports={installMemoryRepository};
