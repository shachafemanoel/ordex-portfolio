'use client';

import { LoginPageContainer } from '@/components/auth/login/LoginPageContainer';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function LoginPage(props: Props) {
  return <LoginPageContainer searchParams={props.searchParams} />;
}
