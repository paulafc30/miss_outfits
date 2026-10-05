import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppShell from '@/components/shared/AppShell'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import Profile from '@/pages/Profile'
import Armario from '@/pages/Armario'
import Venta from '@/pages/Venta'
import Wishlist from '@/pages/Wishlist'
import Inspiracion from '@/pages/Inspiracion'
import Share from '@/pages/Share'
// Pinterest pausado: la API nos denegó el permiso. Se conserva el código comentado para retomarlo.
// import PinterestCallback from '@/pages/PinterestCallback'
import Privacidad from '@/pages/Privacidad'
import Terminos from '@/pages/Terminos'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Register />} />
      <Route path="/recuperar" element={<ForgotPassword />} />
      <Route path="/restablecer" element={<ResetPassword />} />
      {/* <Route path="/pinterest-callback" element={<PinterestCallback />} /> */}
      <Route path="/privacidad" element={<Privacidad />} />
      <Route path="/terminos" element={<Terminos />} />

      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/armario" element={<Armario />} />
        <Route path="/venta" element={<Venta />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/inspiracion" element={<Inspiracion />} />
        <Route path="/perfil" element={<Profile />} />
        <Route path="/share" element={<Share />} />
      </Route>

      <Route path="*" element={<Navigate to="/armario" replace />} />
    </Routes>
  )
}
