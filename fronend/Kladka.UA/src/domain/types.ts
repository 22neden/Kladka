export type ListingKind = 'service' | 'request';
export type ListingStatus = 'active' | 'closed' | 'hidden';
export type CategoryId = 'renovation' | 'electric' | 'plumbing' | 'tile' | 'painting' | 'building' | 'roof' | 'design';
export type Profile = {
  id: string;
  name: string;
  city: string;
  bio: string;
  role: 'customer' | 'professional';
  avatar_url?: string;
  specialties?: CategoryId[];
  experience_years?: number;
  availability?: 'available' | 'busy';
};
export type Listing = {
  id: string;
  owner_id: string;
  kind: ListingKind;
  title: string;
  description: string;
  category: CategoryId;
  city: string;
  price: number | null;
  unit: string;
  images: string[];
  team_name: string;
  status: ListingStatus;
  moderation_status?: 'pending' | 'approved' | 'rejected';
  created_at: string;
};
export type Conversation = {
  id: string;
  participant_a: string;
  participant_b: string;
  listing_id: string | null;
  updated_at: string;
  created_at: string;
};
export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  image_path: string | null;
  created_at: string;
};
export type AccountSettings = { phone: string; newsletter_opt_in: boolean };
export type LocalData = {
  settings?: AccountSettings;
  profile: Profile;
  listings: Listing[];
  conversations: Conversation[];
  messages: Message[];
  favorites: string[];
  blocked: string[];
  readAt: Record<string, string>;
};
export type NewListing = Omit<Listing, 'id' | 'owner_id' | 'status' | 'created_at'>;
export type TabName = 'catalog' | 'requests' | 'create' | 'chats' | 'profile';
export type Route =
  | { name: 'tabs' }
  | { name: 'listing'; id: string }
  | { name: 'chat'; id: string }
  | { name: 'edit'; id?: string; kind?: ListingKind }
  | { name: 'favorites' }
  | { name: 'mine' }
  | { name: 'editProfile' }
  | { name: 'about' }
  | { name: 'settings' }
  | { name: 'publicProfile'; id: string };
