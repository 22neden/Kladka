const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const { Schema } = mongoose;
const id = () => ({ type: String, default: randomUUID });
const schema = fields => new Schema({ _id: id(), ...fields }, { versionKey: false, strict: 'throw' });
const profile = new Schema({ name: String, city: { type: String, default: '' }, bio: { type: String, default: '' }, role: { type: String, default: 'customer' }, avatar_url: { type: String, default: '' }, specialties: { type: [String], default: [] }, experience_years: { type: Number, default: 0 }, availability: { type: String, default: 'available' } }, { _id: false, strict: 'throw' });
const user = schema({ email: { type: String, required: true, unique: true }, passwordHash: { type: String, default: '' }, verified: { type: Boolean, default: false }, profile, mediaBytes: { type: Number, default: 0 }, phone: { type: String, default: '' }, newsletter_opt_in: { type: Boolean, default: false }, provider: String, providerId: String, deleting: { type: Boolean, default: false }, created_at: { type: Date, default: Date.now } });
user.index({ provider: 1, providerId: 1 }, { unique: true, partialFilterExpression: { providerId: { $type: 'string' } } });
const listing = schema({ owner_id: { type: String, required: true, index: true }, kind: String, title: String, description: String, category: String, city: String, price: Number, unit: String, images: [String], team_name: String, status: { type: String, default: 'active' }, moderation_status: { type: String, default: 'pending' }, created_at: { type: Date, default: Date.now } });
listing.index({ moderation_status: 1, status: 1, created_at: -1 });
const conversation = schema({ participant_a: String, participant_b: String, listing_id: String, created_at: { type: Date, default: Date.now }, updated_at: { type: Date, default: Date.now } });
conversation.index({ participant_a: 1, participant_b: 1, listing_id: 1 }, { unique: true });
const message = schema({ conversation_id: { type: String, index: true }, sender_id: String, body: String, image_path: String, client_id: String, created_at: { type: Date, default: Date.now } });
message.index({ sender_id: 1, client_id: 1 }, { unique: true });
message.index({ conversation_id: 1, created_at: -1 });
const session = schema({ user_id: { type: String, index: true }, hash: { type: String, unique: true }, expires: Date }); session.index({ expires: 1 }, { expireAfterSeconds: 0 });
const challenge = schema({ user_id: String, kind: String, hash: String, attempts: { type: Number, default: 0 }, expires: Date, sent_at: Date }); challenge.index({ user_id: 1, kind: 1 }, { unique: true }); challenge.index({ expires: 1 }, { expireAfterSeconds: 0 });
const favorite = schema({ user_id: String, listing_id: String }); favorite.index({ user_id: 1, listing_id: 1 }, { unique: true });
const block = schema({ blocker_id: String, blocked_id: String }); block.index({ blocker_id: 1, blocked_id: 1 }, { unique: true });
const read = schema({ user_id: String, conversation_id: String, last_read_at: Date }); read.index({ user_id: 1, conversation_id: 1 }, { unique: true });
const media = schema({ owner_id: { type: String, index: true }, conversation_id: String, visibility: String, mime: String, bytes: Number, data: { type: Buffer, select: false }, created_at: { type: Date, default: Date.now } });
const ticket = schema({ hash: { type: String, unique: true }, user_id: String, session_id: String, media_id: String, expires: Date }); ticket.index({ expires: 1 }, { expireAfterSeconds: 0 });
const rate = new Schema({ _id: String, count: Number, expires: Date }, { versionKey: false }); rate.index({ expires: 1 }, { expireAfterSeconds: 0 });
const oauth = schema({ hash: { type: String, unique: true }, provider: String, redirect: String, challenge: String, user_id: String, kind: String, expires: Date }); oauth.index({ expires: 1 }, { expireAfterSeconds: 0 });
const offer = schema({
 request_id: { type: String, required: true },
 provider_id: { type: String, required: true },
 message: { type: String, default: '' },
 price: { type: Number, required: true },
 unit: { type: String, default: '' },
 status: { type: String, default: 'pending' },
 created_at: { type: Date, default: Date.now },
 updated_at: { type: Date, default: Date.now },
});
offer.index({ request_id: 1, provider_id: 1 }, { unique: true });
offer.index({ request_id: 1, status: 1, created_at: -1 });
const order = schema({
 request_id: { type: String, required: true },
 offer_id: { type: String, required: true, unique: true },
 customer_id: { type: String, required: true },
 provider_id: { type: String, required: true },
 agreed_price: { type: Number, required: true },
 unit: { type: String, default: '' },
 status: { type: String, default: 'accepted' },
 created_at: { type: Date, default: Date.now },
 updated_at: { type: Date, default: Date.now },
 completed_at: Date,
});
order.index({ request_id: 1 }, { unique: true });
order.index({ customer_id: 1, status: 1, updated_at: -1 });
order.index({ provider_id: 1, status: 1, updated_at: -1 });
const defs = { User: user, Listing: listing, Conversation: conversation, Message: message, Session: session, Challenge: challenge, Favorite: favorite, Block: block, Read: read, Media: media, Ticket: ticket, Rate: rate, OAuth: oauth,
 Report: schema({ reporter_id: String, listing_id: String, reported_id: String, reason: String, created_at: { type: Date, default: Date.now } }),
 Consent: schema({ user_id: String, type: String, value: Boolean, version: String, created_at: { type: Date, default: Date.now } }),
 Offer: offer, Order: order };
module.exports = Object.fromEntries(Object.entries(defs).map(([n,s]) => [n,mongoose.model('Kladka'+n,s,'kladka_'+n.toLowerCase())]));
