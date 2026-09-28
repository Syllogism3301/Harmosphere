import { Suspense } from 'react';
import { AuthForm } from '../../../features/auth/auth-form';
import { RecoveryLink } from '../../../components/recovery-link';
export default function SigninPage() { return <Suspense><AuthForm /><RecoveryLink /></Suspense>; }
