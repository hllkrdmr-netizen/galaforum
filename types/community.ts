import type { AuthorSummary, Category } from './forum';

export interface Badge {
  id: string;
  name: string;
  description: string;
  /** Ionicons glyph name */
  icon: string;
  awardedAt?: string;
}

export interface CommunityProfile {
  userId: string;
  bio: string | null;
  city: string | null;
  favoriteCategory: Pick<Category, 'slug' | 'name'> | null;
  followers: number;
  following: number;
  isFollowing: boolean;
  badges: Badge[];
}

export type FollowKind = 'user' | 'topic' | 'category';

export interface MyFollows {
  users: AuthorSummary[];
  topics: Array<{ id: string; title: string }>;
  /** category slugs */
  categories: string[];
}

export interface ActiveMember {
  id: string;
  username: string;
  avatarUrl: string | null;
  postCount: number;
}

export interface Meetup {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  city: string;
  placeName: string;
  address: string;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  matchId: string | null;
  organizer: AuthorSummary | null;
  cancelled: boolean;
  attendeeCount: number;
  isAttending: boolean;
}

export interface MeetupDetail extends Meetup {
  attendees: AuthorSummary[];
}

/** Raw form values (strings as typed by the member). */
export interface MeetupForm {
  title: string;
  description: string;
  /** GG.AA.YYYY */
  date: string;
  /** SS:DD */
  time: string;
  city: string;
  placeName: string;
  address: string;
  /** Optional "41.0082, 28.9784" or a Google/Apple Maps link */
  location: string;
  /** Optional, empty = unlimited */
  capacity: string;
  matchId: string | null;
}

export interface CreateMeetupInput {
  title: string;
  description: string;
  startsAt: string;
  city: string;
  placeName: string;
  address: string;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  matchId: string | null;
}

export interface ProfileUpdate {
  bio: string;
  city: string;
  favoriteCategorySlug: string | null;
}
