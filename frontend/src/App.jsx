import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Goals from "./pages/Goals";
import AppLayout from "./components/AppLayout";
import { getToken } from "./api";
import "./ui.css";

// Só deixa entrar nas páginas internas quem tem token
function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/" replace />;
}

// Quem já está logado não precisa ver a tela de login de novo
function PublicRoute({ children }) {
  return getToken() ? <Navigate to="/dashboard" replace /> : children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/transacoes" element={<Transactions />} />
          <Route path="/metas" element={<Goals />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
