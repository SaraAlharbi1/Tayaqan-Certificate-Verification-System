import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css' 

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-slate-50 text-gray-800 flex flex-col items-center justify-center gap-6 p-6">
      <div className="flex items-center gap-6">
        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src={viteLogo} className="h-16 w-16 hover:scale-110 transition" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="h-16 w-16 hover:scale-110 transition" alt="React logo" />
        </a>
      </div>

      <h1 className="text-3xl font-bold text-blue-600">Vite + React + Tailwind</h1>

      <div className="rounded-2xl bg-white shadow p-6">
        <button
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 active:scale-95 transition"
          onClick={() => setCount((c) => c + 1)}
        >
          count is {count}
        </button>
        <p className="mt-3 text-sm text-gray-500">
          Edit <code className="font-mono">src/App.jsx</code> and save to test HMR
        </p>
      </div>

      <p className="text-xs text-gray-400">
        Click the logos to learn more
      </p>
    </div>
  )
}

export default App
