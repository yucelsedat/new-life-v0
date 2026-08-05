import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Game from './pages/Game'
import Admin from './pages/Admin'
import AdminWorldEditor from './pages/AdminWorldEditor'
import AdminWorldCanvas from './pages/AdminWorldCanvas'
import AdminWorldAssets from './pages/AdminWorldAssets'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:worldId" element={<Game />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/worlds/:worldId" element={<AdminWorldEditor />} />
        <Route path="/admin/worlds/:worldId/canvas" element={<AdminWorldCanvas />} />
        <Route path="/admin/worlds/:worldId/assets" element={<AdminWorldAssets />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
