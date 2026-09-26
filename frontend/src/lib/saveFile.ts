import { Capacitor } from '@capacitor/core'

/**
 * Hand a file to you: the share sheet (save to Drive/Files, mail it…), else a download.
 * In the Android app, the file is written to the app's cache first and shared from there
 * (a webview can't download or share files by itself).
 */
export async function saveFile(name: string, text: string, type: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ])
    const { uri } = await Filesystem.writeFile({
      path: name,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    try {
      await Share.share({ title: name, files: [uri] })
    } catch (e) {
      if (!/cancel/i.test((e as Error).message)) throw e // closing the share sheet is fine
    }
    return
  }

  const file = new File([text], name, { type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return // cancelled by you
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
}
