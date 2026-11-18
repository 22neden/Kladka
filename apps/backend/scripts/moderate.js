require('dotenv').config();
const mongoose=require('mongoose');
const {Listing}=require('../src/models');
(async()=>{
 const [id,status]=process.argv.slice(2);
 if(!id||!['approved','rejected','pending'].includes(status))throw new Error('Використання: npm run moderate -- ID approved|rejected|pending');
 if(!process.env.MONGODB_URI)throw new Error('MONGODB_URI не задано');
 await mongoose.connect(process.env.MONGODB_URI);
 const item=await Listing.findByIdAndUpdate(id,{$set:{moderation_status:status}},{new:true});
 if(!item)throw new Error('Оголошення не знайдено');
 console.log(`Оголошення ${item._id}: ${item.moderation_status}`);
})().catch(e=>{console.error(e.message.includes('Використання')?e.message:'Модерація не виконана. Перевірте ID, статус і підключення.');process.exitCode=1;}).finally(()=>mongoose.disconnect());
