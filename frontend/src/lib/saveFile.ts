import { Capacitor } from '@capacitor/core'

/**
 * Hand a file to you: the share sheet (save to Drive/Files, mail it…), else a download.
 * In the Android app, the file is written to the app's cache first and shared from there
 * (a webview can't download or share files by itself). Returns false when you closed the
 * share sheet without choosing anything.
 */
export async function saveFile(
  name: string,
  data: string | Uint8Array,
  type: string,
): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ])
    const { uri } = await Filesystem.writeFile({
      path: name,
      directory: Directory.Cache,
      // Text as-is; binary files (the backup zip) go over the bridge as base64.
      ...(typeof data === 'string' ? { data, encoding: Encoding.UTF8 } : { data: toBase64(data) }),
    })
    try {
      await Share.share({ title: name, files: [uri] })
      return true
    } catch (e) {
      if (/cancel/i.test((e as Error).message)) return false // closing the share sheet is fine
      throw e
    }
  }

  const file = new File([data as BlobPart], name, { type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return true
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false // cancelled by you
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
  return true
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}
