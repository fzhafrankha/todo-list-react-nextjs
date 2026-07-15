import { ResetPasswordForm } from "@/components/ResetPasswordForm";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold">Reset password</h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-sm text-red-600">Missing reset token.</p>
      )}
    </main>
  );
}
