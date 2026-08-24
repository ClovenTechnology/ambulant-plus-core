import { redirect } from 'next/navigation';

export default function LegacyShopRedirectPage() {
  redirect('/settings/shop');
}
