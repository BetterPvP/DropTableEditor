import { Metadata } from 'next';
import { SignUpForm } from '@/components/auth/sign-up-form';

export const metadata: Metadata = {
  title: 'Sign up | BetterPvP Admin Console',
};

export default function SignUpPage() {
  return <SignUpForm />;
}
