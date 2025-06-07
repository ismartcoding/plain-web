type WithStylesheet = typeof globalThis & {
  [stylesheetName: string]: CSSStyleSheet | undefined
}

/**
 * Applies a stringified CSS theme to a document or shadowroot by creating or
 * reusing a constructable stylesheet. It also saves the themeString to
 * localstorage.
 *
 * NOTE: This function is inlined into the head of the document for performance
 * reasons as well as used by material-color-helpers which is lazily loaded. So
 * do not overload this file with slow logic since it will block render.
 *
 * @param doc Document or ShadowRoot to apply theme.
 * @param themeString Stringified CSS of a material theme to apply to the given
 *     document or shadowroot.
 * @param ssName Optional global identifier of the constructable stylesheet and
 *     used to generate the localstorage name.
 */
export function applyThemeString(doc: DocumentOrShadowRoot, themeString: string, ssName = 'material-theme') {
  // Get constructable stylesheet
  let sheet = (globalThis as WithStylesheet)[ssName]
  // Create a new sheet if it doesn't exist already and save it globally.
  if (!sheet) {
    try {
      // Modern browsers support
      sheet = new CSSStyleSheet()
      ;(globalThis as WithStylesheet)[ssName] = sheet
      doc.adoptedStyleSheets.push(sheet)
    } catch (e) {
      // Fallback for older browsers (like old Safari versions)
      const styleEl = document.createElement('style')
      styleEl.textContent = themeString
      styleEl.setAttribute('data-ss-name', ssName)
      
      // Remove any previous style with same name
      const oldStyle = document.querySelector(`style[data-ss-name="${ssName}"]`)
      if (oldStyle) {
        oldStyle.remove()
      }
      
      // Append to document.head or to the document/shadowRoot directly
      if ('head' in doc) {
        (doc as Document).head?.appendChild(styleEl)
      } else {
        (doc as ShadowRoot).appendChild(styleEl)
      }
      
      // Set the theme string directly and return early
      localStorage.setItem(ssName, themeString)
      
      // Set theme color for URL bar
      const surfaceContainer = themeString.match(/--md-sys-color-surface-container:(.+?);/)?.[1]
      if (surfaceContainer) {
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surfaceContainer)
      }
      
      return
    }
  }

  // Set the color of the URL bar because we are cool like that.
  const surfaceContainer = themeString.match(/--md-sys-color-surface-container:(.+?);/)?.[1]
  if (surfaceContainer) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surfaceContainer)
  }

  try {
    sheet.replaceSync(themeString)
  } catch (e) {
    // For browsers where replaceSync might fail
    const styleEl = document.querySelector(`style[data-ss-name="${ssName}"]`)
    if (styleEl) {
      styleEl.textContent = themeString
    } else {
      const newStyle = document.createElement('style')
      newStyle.textContent = themeString
      newStyle.setAttribute('data-ss-name', ssName)
      if ('head' in doc) {
        (doc as Document).head?.appendChild(newStyle)
      } else {
        (doc as ShadowRoot).appendChild(newStyle)
      }
    }
  }
  
  localStorage.setItem(ssName, themeString)
}
