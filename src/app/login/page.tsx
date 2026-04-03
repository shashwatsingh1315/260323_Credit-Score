"use client";
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    const supabase = createClient();
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo('Check your email to confirm your account, then sign in.');
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (error) throw error;
        setInfo('Password reset instructions sent to your email.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(''); setInfo(''); setLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -z-10 animate-pulse delay-1000 pointer-events-none" />

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4 justify-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg ring-1 ring-border/50">
            <ShieldCheck size={28} className="text-primary-foreground" />
          </div>
          <span className="text-2xl font-extrabold text-foreground tracking-tight">CreditFlow</span>
        </div>

        <Card className="border-border/60 shadow-xl shadow-black/5 rounded-[2rem] overflow-hidden backdrop-blur-xl bg-card/80">
          <CardHeader className="text-center pb-6 pt-8">
            <CardTitle className="text-2xl font-bold tracking-tight">{mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Reset Password'}</CardTitle>
            <CardDescription className="text-base mt-2">
              {mode === 'signin' ? 'Sign in to your account to continue' : mode === 'signup' ? 'Create your CreditFlow account' : 'Enter your email to receive a reset link'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Email</Label>
                <Input id="email" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-12 px-4 rounded-xl bg-muted/40 border-border/50 focus:bg-background transition-colors" />
              </div>
              {mode !== 'reset' && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Password</Label>
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="h-12 px-4 rounded-xl bg-muted/40 border-border/50 focus:bg-background transition-colors" />
                </div>
              )}

              {error && <p className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-xl border border-destructive/20">{error}</p>}
              {info && <p className="text-sm text-success bg-success/10 px-4 py-3 rounded-xl border border-success/20">{info}</p>}

              <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold shadow-md transition-all duration-300 ease-out hover:shadow-lg active:scale-[0.98]" disabled={loading}>
                {loading && <Loader2 size={18} className="animate-spin mr-2" />}
                {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Send Reset Link'}
              </Button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest font-semibold">
                <span className="bg-card px-4 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              type="button"
              className="w-full h-12 rounded-xl text-base font-semibold border-border/60 hover:bg-muted/50 transition-all duration-300 ease-out"
              disabled={loading}
              onClick={handleGoogleSignIn}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin mr-2" />
              ) : (
                <svg className="mr-3 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                  <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                </svg>
              )}
              Google
            </Button>

            <div className="mt-6 text-center flex flex-col gap-2">
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(''); setInfo(''); }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot your password?
                </button>
              )}
              <button
                type="button"
                onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(''); setInfo(''); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {mode === 'signin' || mode === 'reset' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setError(''); setInfo(''); }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back to Sign in
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
