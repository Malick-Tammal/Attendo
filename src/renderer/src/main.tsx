import "./assets/global.css"

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { SharedElementTransition } from "react-aria-components"
import App from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SharedElementTransition>
      <App />
    </SharedElementTransition>
  </StrictMode>
)
