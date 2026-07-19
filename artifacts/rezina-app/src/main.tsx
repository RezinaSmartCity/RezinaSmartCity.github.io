import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const redirect = sessionStorage.redirect;
delete sessionStorage.redirect;

if (redirect && redirect !== location.pathname) {
  history.replaceState(null, '', redirect);
}

createRoot(document.getElementById('root')!).render(
  <App />
)
