import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AiButton } from '@/components/AiButton'
import { ImageDropzone } from '@/components/ImageDropzone'
import { TagInput } from '@/components/TagInput'
import {
  describeDraftImage,
  discardGeneratedImage,
  generateImage,
  proofreadText,
  suggestTags,
} from '@/lib/ai'
import { listTags } from '@/lib/api'

const SUBMIT_STATUS = {
  saving: 'Saving…',
  describing: 'Describing image…',
}

const TAG_STATUS = {
  describing: 'Describing image…',
  suggesting: 'Suggesting tags…',
}

/**
 * Shared by "Add your first inspiration", "Add inspiration", and "Edit inspiration".
 *
 * initial: { note, image: { url, path } | null, imageDescription, tags: string[] }
 * inspirationId: set when editing (used for the AI request log).
 *
 * onSubmit({ note, image, tagNames, noteLanguage, imageDescription }, { setStatus })
 *   image: { file } | { url, path } | { url, path, generated: true, prompt } | null
 *   noteLanguage: 'pl' | 'en' when the note is the proofread text, else null
 *   imageDescription: { text, model } when "Suggest tags" described this image
 *     in the form, else null. The page saves it and skips the describe step.
 *   setStatus('describing'): changes the submit button label
 */
export function InspirationForm({
  title,
  submitLabel,
  initial,
  inspirationId,
  onSubmit,
  onCancel,
  cancelLabel = 'Cancel',
}) {
  const [note, setNote] = useState(initial?.note ?? '')
  const [image, setImage] = useState(initial?.image ?? null)
  const [tags, setTags] = useState(initial?.tags ?? [])
  const [suggestions, setSuggestions] = useState([])
  const [status, setStatus] = useState(null) // null | 'saving' | 'describing'
  const [error, setError] = useState(null)
  const [proofreading, setProofreading] = useState(false)
  const [generating, setGenerating] = useState(false)
  // Last proofread result. The save marks the note as proofread only if it is unchanged.
  const [proofread, setProofread] = useState(null) // { text, language } | null
  const [tagStatus, setTagStatus] = useState(null) // null | 'describing' | 'suggesting'
  // The description of one image object. A new image is a new object, so an
  // old description is never used for it.
  const [described, setDescribed] = useState(() =>
    initial?.image && initial?.imageDescription
      ? { image: initial.image, text: initial.imageDescription, model: null, fresh: false }
      : null,
  )

  const saving = status !== null
  const suggesting = tagStatus !== null
  const busy = saving || proofreading || generating || suggesting
  const hasNote = note.trim().length > 0
  const canSubmit = (hasNote || image) && !busy

  // A generated image is in storage before the save. Remember it, so we can
  // delete it if the user replaces it, removes it, or leaves without saving.
  const unsavedGenerated = useRef(null)
  const submitted = useRef(false)
  const initialPath = initial?.image?.path ?? null

  useEffect(() => {
    listTags()
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
  }, [])

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      const path = unsavedGenerated.current
      if (path && !submitted.current) discardGeneratedImage(path)
    }
  }, [])

  function changeImage(next) {
    const old = unsavedGenerated.current
    if (old && old !== next?.path) {
      discardGeneratedImage(old)
      unsavedGenerated.current = null
    }
    if (next?.generated && next.path !== initialPath) unsavedGenerated.current = next.path
    setImage(next)
  }

  async function handleProofread() {
    const before = note
    setProofreading(true)
    try {
      const result = await proofreadText(note, inspirationId)
      setProofread({ text: result.text, language: result.language })
      if (!result.changed) {
        toast('No changes needed')
        return
      }
      setNote(result.text)
      toast('Note is proofread', {
        duration: 6000,
        action: { label: 'Undo', onClick: () => setNote(before) },
      })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setProofreading(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const result = await generateImage(note)
      if (!alive.current) {
        // The user left the form while the image was made.
        discardGeneratedImage(result.path)
        return
      }
      changeImage({ url: result.url, path: result.path, generated: true, prompt: result.prompt })
      toast('Image is generated')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSuggestTags() {
    try {
      // Tags come from the note and the image description. An image with
      // no description gets one now, and not later at the save.
      let description = image && described?.image === image ? described.text : ''
      if (image && !description) {
        setTagStatus('describing')
        const result = await describeDraftImage(image)
        if (!alive.current) return
        description = result.description
        setDescribed({ image, text: result.description, model: result.model, fresh: true })
      }

      setTagStatus('suggesting')
      const result = await suggestTags({
        note,
        imageDescription: description,
        currentTags: tags,
        inspirationId,
      })
      if (!alive.current) return
      // Add the tags directly. The user removes the ones that do not fit.
      const have = new Set(tags.map((t) => t.toLowerCase()))
      const added = result.tags.filter((t) => !have.has(t.toLowerCase()))
      if (added.length === 0) {
        toast('No new tag ideas')
        return
      }
      setTags([...tags, ...added])
      toast(added.length === 1 ? '1 tag is added' : `${added.length} tags are added`, {
        duration: 6000,
        action: {
          label: 'Undo',
          onClick: () => setTags((now) => now.filter((t) => !added.includes(t))),
        },
      })
    } catch (err) {
      toast.error(err.message)
    } finally {
      if (alive.current) setTagStatus(null)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) {
      if (!busy) setError('Add a note, an image, or both.')
      return
    }
    setError(null)
    setStatus('saving')
    const noteLanguage = proofread && proofread.text.trim() === note.trim() ? proofread.language : null
    // Set before the save: the page can leave (and unmount the form) inside onSubmit.
    submitted.current = true
    // Only a description written in this form, for the image that is saved.
    const imageDescription =
      image && described?.fresh && described.image === image
        ? { text: described.text, model: described.model }
        : null
    try {
      await onSubmit({ note, image, tagNames: tags, noteLanguage, imageDescription }, { setStatus })
      unsavedGenerated.current = null
    } catch (err) {
      submitted.current = false
      setError(err.message ?? 'Something went wrong. Try again.')
      setStatus(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-[472px] flex-col gap-12">
      <h1 className="font-[Arial,sans-serif] text-[128px] leading-[160px] font-medium tracking-[-2.56px] sm:text-[160px] sm:leading-[192px] sm:tracking-[-3.2px]">
        {title}
      </h1>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="note">Note</Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A quote, thought, or image note"
            className="max-h-[320px]"
            readOnly={proofreading}
            aria-busy={proofreading || undefined}
          />
          <AiButton
            onClick={handleProofread}
            loading={proofreading}
            loadingLabel="Proofreading…"
            disabled={!hasNote || saving || generating || suggesting}
            hint="Write a note first"
          >
            Proofread
          </AiButton>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="image">Image</Label>
          <ImageDropzone id="image" value={image} onChange={changeImage} disabled={generating || suggesting} />
          <AiButton
            onClick={handleGenerate}
            loading={generating}
            loadingLabel="Generating image…"
            disabled={!hasNote || saving || proofreading || suggesting}
            hint="Write a note first. The image is made from it."
          >
            Generate
          </AiButton>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tags">Tags</Label>
          <TagInput id="tags" value={tags} onChange={setTags} suggestions={suggestions} />
          <AiButton
            onClick={handleSuggestTags}
            loading={suggesting}
            loadingLabel={TAG_STATUS[tagStatus]}
            disabled={(!hasNote && !image) || saving || proofreading || generating}
            hint="Add a note or an image first. Tags are suggested from them."
          >
            Suggest tags
          </AiButton>
        </div>
      </div>

      {error && (
        <p role="alert" className="-mt-6 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {saving ? SUBMIT_STATUS[status] : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            {cancelLabel}
          </Button>
        )}
      </div>
    </form>
  )
}

/** Converts form output to the image fields that lib/api.js expects. */
export function toApiImage(image, currentImagePath = null) {
  if (image?.file) return { file: image.file, generated: null, removeImage: false }
  if (image?.generated && image.path !== currentImagePath) {
    return { file: null, generated: { path: image.path, prompt: image.prompt }, removeImage: false }
  }
  if (!image && currentImagePath) return { file: null, generated: null, removeImage: true }
  return { file: null, generated: null, removeImage: false }
}

/** True when the save puts a new image on the inspiration. */
export function hasNewImage(apiImage) {
  return Boolean(apiImage.file || apiImage.generated)
}
