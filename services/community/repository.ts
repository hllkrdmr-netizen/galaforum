import type {
  ActiveMember,
  CommunityProfile,
  CreateMeetupInput,
  FollowKind,
  Meetup,
  MeetupDetail,
  MyFollows,
  ProfileUpdate,
} from '../../types/community';

/** Community data: profile extras, follows, badges, meetups (demo and Supabase implementations). */
export interface CommunityRepository {
  readonly mode: 'demo' | 'supabase';
  getProfileExtras(username: string): Promise<CommunityProfile | null>;
  updateMyProfile(update: ProfileUpdate): Promise<void>;
  /** Returns the new state. `target`: username (user), topic id (topic) or category slug (category). */
  setFollow(kind: FollowKind, target: string, on: boolean): Promise<boolean>;
  /** Empty lists when signed out. */
  getMyFollows(): Promise<MyFollows>;
  activeMembers(limit?: number): Promise<ActiveMember[]>;
  /** Upcoming, not cancelled; optionally filtered by city (case-insensitive). */
  listMeetups(city?: string): Promise<Meetup[]>;
  getMeetup(id: string): Promise<MeetupDetail | null>;
  createMeetup(input: CreateMeetupInput): Promise<{ id: string }>;
  /** Returns the attendee count after the change. */
  setAttendance(id: string, join: boolean): Promise<number>;
  cancelMeetup(id: string): Promise<void>;
}
