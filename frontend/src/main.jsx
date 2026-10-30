import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  BrowserRouter
} from 'react-router-dom'

import App from './App'
import { SchoolProvider } from './school'

import './index.css'

ReactDOM.createRoot(
  document.getElementById('root')
).render(
  <React.StrictMode>
    <BrowserRouter>
      <SchoolProvider><App /></SchoolProvider>
    </BrowserRouter>
  </React.StrictMode>
)
