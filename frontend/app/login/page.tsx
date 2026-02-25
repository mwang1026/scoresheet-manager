import SignInButton from "./SignInButton";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "Access denied — your email is not authorized for this app.",
  OAuthCallbackError: "OAuth callback error — check Google redirect URI configuration.",
  Configuration: "Server configuration error — check AUTH_SECRET and OAuth credentials.",
  Default: "Authentication failed. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const resolvedParams = await searchParams;
  const errorCode = resolvedParams?.error;
  const errorMessage = errorCode
    ? (AUTH_ERROR_MESSAGES[errorCode] ?? `Auth error: ${errorCode}`)
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 border rounded-lg">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Scoresheet Manager</h1>
          <p className="text-sm text-muted-foreground">
            Fantasy baseball management for Scoresheet leagues.
          </p>
        </div>
        {errorMessage && (
          <p className="text-sm text-destructive border border-destructive/30 rounded px-3 py-2 bg-destructive/5">
            {errorMessage}
          </p>
        )}
        <SignInButton />
      </div>
    </div>
  );
}
