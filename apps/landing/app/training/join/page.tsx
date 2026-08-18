import type { Metadata } from 'next';
import GuestTrainingJoinClient from './GuestTrainingJoinClient';

export const metadata: Metadata = {
  title: 'Secure training invitation',
  description:
    'Verify an Ambulant+ external training invitation and join the authorised training session.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function GuestTrainingJoinPage() {
  return <GuestTrainingJoinClient />;
}
