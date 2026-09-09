import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App.tsx'
import '@/styles.css'
// The component styles only. Deliberately not `@weasel-js/theme`'s tokens.css,
// which also sets a document font and would re-type the whole wall.
import '@weasel-js/ui/style.css'
import '@/weasel.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
