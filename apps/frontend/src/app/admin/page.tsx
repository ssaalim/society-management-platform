import { redirect } from 'next/navigation';

/** The platform console moved to /platform. */
export default function AdminRedirect() {
  redirect('/platform');
}
