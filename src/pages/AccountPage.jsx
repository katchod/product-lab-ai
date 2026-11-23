import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserAvatar } from '@/components/UserAvatar'
import { ACCEPTED_TYPES, validateImage } from '@/components/ImageDropzone'
import { useAuth } from '@/context/AuthContext'
import { updatePassword, updateProfile } from '@/lib/api'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // matches the "avatars" bucket limit
const MIN_PASSWORD = 6

export function AccountPage() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (profile) setName(profile.display_name ?? '')
  }, [profile])

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null)
      return
    }
    const url = URL.createObjectURL(avatarFile)
    setAvatarPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  function pickAvatar(file) {
    if (!file) return
    const problem = validateImage(file, MAX_AVATAR_BYTES)
    if (problem) {
      toast.error(problem)
      return
    }
    setAvatarFile(file)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    if (password && password.length < MIN_PASSWORD) {
      setError(`The password must have at least ${MIN_PASSWORD} characters.`)
      return
    }

    setSaving(true)
    try {
      await updateProfile({
        userId: user.id,
        displayName: name,
        avatarFile,
        oldAvatarPath: profile?.avatar_path,
      })
      if (password) await updatePassword(password)
      await refreshProfile()
      setPassword('')
      setAvatarFile(null)
      toast('Account is updated')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12 sm:px-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-[472px] flex-col gap-12">
        <h1 className="font-[Arial,sans-serif] text-[128px] leading-[160px] font-medium tracking-[-2.56px] sm:text-[160px] sm:leading-[192px] sm:tracking-[-3.2px]">
          Account settings
        </h1>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="avatar">Avatar</Label>
            <button
              id="avatar"
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative size-20 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label="Change avatar"
            >
              <UserAvatar
                url={avatarPreview ?? profile?.avatarUrl}
                name={name || user?.email}
                className="size-20 text-[80px]"
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                Change
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="hidden"
              onChange={(e) => {
                pickAvatar(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              maxLength={80}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Type password"
              autoComplete="new-password"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="-mt-6 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Update'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/')} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </main>
  )
}
