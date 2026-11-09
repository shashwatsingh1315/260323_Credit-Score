"use client";
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { friendlyPasswordError } from '../login/messages';

type SessionState = 'checking' | 'valid' | 'expired';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>('checking');
  const router = useRouter();

  // The reset link only works once the callback has exchanged it for a session.
  // Check before showing the form so an expired link fails up front, not after typing.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setSessionState(session ? 'valid' : 'expired');
    }).catch(() => {
      if (!cancelled) setSessionState('expired');
    });
    return () => { cancelled = true; };
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError("The two passwords don't match. Re-enter them and try again.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      toast.success('Password updated. Welcome back.');
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(friendlyPasswordError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <KeyRound size={20} className="text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">CreditFlow</span>
        </div>

        <Card>
          {sessionState === 'checking' && (
            <CardContent className="py-10 flex justify-center">
              <Loader2 size={20} className="animate-spin text-muted-foreground" aria-label="Checking your reset link" />
            </CardContent>
          )}

          {sessionState === 'expired' && (
            <>
              <CardHeader className="text-center pb-4">
                <CardTitle>This reset link has expired</CardTitle>
                <CardDescription>
                  Reset links can only be used once and expire after a short time. Request a new one to continue.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/login?mode=reset">Send a new link</Link>
                </Button>
              </CardContent>
            </>
          )}

          {sessionState === 'valid' && (
            <>
              <CardHeader className="text-center pb-4">
                <CardTitle>Set New Password</CardTitle>
                <CardDescription>
                  Please enter your new password below.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="password">New Password</Label>
                    <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} />
                  </div>

                  {error && <p role="alert" className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 size={16} className="animate-spin mr-2" />}
                    Update Password
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
