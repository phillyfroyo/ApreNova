export async function updateNativeLanguage(lang: 'en' | 'es') {
  await fetch('/api/user/update-field', {
    method: 'POST',
    body: JSON.stringify({
      field: 'nativeLanguage',
      value: lang,
    }),
  })
  document.cookie = `preferredLang=${lang}; path=/; max-age=31536000`
}
