import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

function renderApp() {
	try {
		ReactDOM.createRoot(document.getElementById('root')).render(<App />)
	} catch (err) {
		console.error('Render error:', err)
		const root = document.getElementById('root')
		if (root) {
			root.innerText = 'Application error: ' + (err && err.message ? err.message : String(err)) + '\n\nSee console for details.'
		}
	}
}

// Global error handler to show unexpected errors in production builds
window.addEventListener('error', (ev) => {
	const root = document.getElementById('root')
	if (root) {
		root.innerText = 'Unhandled error: ' + (ev && ev.error && ev.error.message ? ev.error.message : ev.message)
	}
	console.error('Unhandled error event', ev)
})

window.addEventListener('unhandledrejection', (ev) => {
	// Intercept common media-playback failures and offer download+play fallback
	const reason = ev && ev.reason ? (ev.reason.message || String(ev.reason)) : ''
	const msg = String(reason || '')
	const lower = msg.toLowerCase()
	if (lower.includes('no supported source') || lower.includes('failed to load because no supported source') || lower.includes('failed to load') || lower.includes('network') || lower.includes('cors')) {
		console.warn('[Main] Swallowed media/network error (likely audio codec/CORS):', reason)
		// Prevent default error display — let Player component handle it
		ev.preventDefault()
		return
	}
	const root = document.getElementById('root')
	if (root) {
		root.innerText = 'Unhandled promise rejection: ' + (ev && ev.reason ? (ev.reason.message || String(ev.reason)) : 'unknown')
	}
	console.error('Unhandled rejection', ev)
})

renderApp()