import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Game from './pages/Game'
import Admin from './pages/Admin'
import AdminWorldEditor from './pages/AdminWorldEditor'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game" element={<Game />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/worlds/:worldId" element={<AdminWorldEditor />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
