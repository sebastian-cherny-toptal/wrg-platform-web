import { Download } from 'lucide-react'
import { toJpeg, toPng, toSvg } from 'html-to-image'
import { useState, type RefObject } from 'react'
import { Button, cn } from './ui'

type DownloadFormat = 'jpg' | 'png' | 'svg'

async function downloadElement(
  element: HTMLElement | null,
  filename: string,
  format: DownloadFormat,
) {
  if (!element) return
  const options = {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
    skipFonts: true,
    filter: (node: HTMLElement) => {
      if (node === element) return true
      const domNode: Node = node
      return !(
        domNode instanceof Element &&
        domNode.classList.contains('download-exclude')
      )
    },
  }
  const dataUrl =
    format === 'svg'
      ? await toSvg(element, options)
      : format === 'jpg'
        ? await toJpeg(element, { ...options, quality: 0.95 })
        : await toPng(element, options)
  const anchor = document.createElement('a')
  anchor.download = `${filename}.${format}`
  anchor.href = dataUrl
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

export function ImageDownloadMenu({
  targetRef,
  name,
  label = 'Download Report',
  iconOnly = false,
  disabled = false,
  onDownloadXlsx,
  className,
}: {
  targetRef: RefObject<HTMLElement | null>
  name: string
  label?: string
  iconOnly?: boolean
  disabled?: boolean
  onDownloadXlsx?: () => Promise<void>
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function download(format: DownloadFormat) {
    setOpen(false)
    setDownloading(true)
    try {
      await downloadElement(targetRef.current, name, format)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className={cn('download-exclude relative', className)}
      onClick={(event) => event.stopPropagation()}
    >
      {iconOnly ? (
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Download ${name}`}
          className="p-1 text-zinc-500 hover:text-zinc-900 disabled:opacity-50"
          disabled={disabled || downloading}
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <Download className="size-4" />
        </button>
      ) : (
        <Button
          aria-expanded={open}
          aria-haspopup="menu"
          className="gap-2 rounded-md"
          disabled={disabled || downloading}
          onClick={() => setOpen((value) => !value)}
        >
          <Download className="size-4" /> {downloading ? 'Preparing…' : label}
        </Button>
      )}
      {open ? (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-44 rounded-lg border border-zinc-200 bg-white p-1 shadow-xl"
          role="menu"
        >
          {(['png', 'svg', 'jpg'] as const).map((format) => (
            <button
              className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100"
              key={format}
              onClick={() => void download(format)}
              role="menuitem"
              type="button"
            >
              Download as {format.toUpperCase()}
            </button>
          ))}
          {onDownloadXlsx ? (
            <button
              className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100"
              onClick={() => {
                setOpen(false)
                setDownloading(true)
                void onDownloadXlsx().finally(() => setDownloading(false))
              }}
              role="menuitem"
              type="button"
            >
              Download report as XLSX
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
