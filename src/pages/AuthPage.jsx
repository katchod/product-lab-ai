import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/context/AuthContext'
import { DEMO_EMAIL, DEMO_PASSWORD, ensureDemoUser } from '@/lib/mock/store'
import { isMockMode } from '@/lib/supabase'
import heroImage from '@/assets/auth-hero.png'

const COPY = {
  login: { title: 'Welcome back', submit: 'Log in', busy: 'Logging in…' },
  signup: { title: 'Hello new friend', submit: 'Sign up', busy: 'Signing up…' },
}

/** "login" and "signup" frames. mode: 'login' | 'signup' */
export function AuthPage({ mode }) {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const copy = COPY[mode]

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)

    const { data, error: authError } =
      mode === 'login' ? await signIn(email, password) : await signUp(email, password)

    setBusy(false)
    if (authError) {
      setError(authError.message)
      return
    }
    // With "Confirm email" on, sign up returns no session yet.
    if (mode === 'signup' && !data.session) {
      setNotice('Check your inbox and confirm your email. Then log in.')
    }
    // With a session, PublicOnlyRoute redirects to the board.
  }

  // Mock mode only: create the demo account with sample data, then log in.
  async function handleDemo() {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      await ensureDemoUser()
      const { error: authError } = await signIn(DEMO_EMAIL, DEMO_PASSWORD)
      if (authError) setError(authError.message)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="flex min-h-svh gap-6 p-4 sm:p-6 lg:h-svh">
      <div className="flex flex-1 flex-col">
        <Logo to="/login" />
        <div className="flex flex-1 items-center justify-center py-12 lg:justify-start lg:pl-12 xl:pl-[124px]">
          <div className="flex w-full max-w-[472px] flex-col gap-12">
            <h1 className="font-[Arial,sans-serif] text-[128px] leading-[160px] font-medium tracking-[-2.56px] sm:text-[160px] sm:leading-[192px] sm:tracking-[-3.2px]">
              {copy.title}
            </h1>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex gap-1" role="tablist" aria-label="Log in or sign up">
                <Button asChild variant="ghost" data-active={mode === 'login'} role="tab" aria-selected={mode === 'login'}>
                  <Link to="/login" replace>Log in</Link>
                </Button>
                <Button asChild variant="ghost" data-active={mode === 'signup'} role="tab" aria-selected={mode === 'signup'}>
                  <Link to="/signup" replace>Sign up</Link>
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Type your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="Type your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="rounded-card bg-surface p-4 text-sm leading-5">
                  {notice}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="lg" disabled={busy}>
                  {busy ? copy.busy : copy.submit}
                </Button>
                {isMockMode && (
                  <Button type="button" variant="secondary" size="lg" disabled={busy} onClick={handleDemo}>
                    Use demo account
                  </Button>
                )}
              </div>
            </form>

            {isMockMode && (
              <p className="-mt-6 rounded-card bg-surface p-4 text-sm leading-5 text-ink-muted">
                <span className="font-medium text-foreground">Mock mode.</span> No Supabase is
                connected, so data stays in this browser. Sign up with any email, or use the
                demo account ({DEMO_EMAIL} / {DEMO_PASSWORD}).
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right panel (Figma "item"): grey card with the hero image. */}
      <div className="hidden min-h-0 w-1/2 items-center justify-center overflow-hidden rounded-card bg-surface p-[120px] lg:flex">
        <img
          src={heroImage}
          alt=""
          width={768}
          height={1376}
          className="h-full max-h-full w-auto min-w-0 rounded-lg object-contain"
        />
      </div>
    </div>
  )
}
