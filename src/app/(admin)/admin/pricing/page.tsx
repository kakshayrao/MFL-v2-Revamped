import { redirect } from 'next/navigation';

// This admin pricing page has been removed; redirect to tiers list.
export default function PricingPage() {
  redirect('/admin/tiers');
}
