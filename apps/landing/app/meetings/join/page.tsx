import type { Metadata } from 'next';
import GuestMeetingJoinClient from './GuestMeetingJoinClient';

export const metadata: Metadata = {
  title: 'Secure meeting invitation',
  description: 'Verify an Ambulant+ external meeting invitation and enter the secure lobby.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function GuestMeetingJoinPage() {
  return <GuestMeetingJoinClient />;
}
