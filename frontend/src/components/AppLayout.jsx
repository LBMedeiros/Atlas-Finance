import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearToken, request } from "../api";
import Icon from "./Icon";
import "./AppLayout.css";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/transacoes", label: "Transações", icon: "transactions" },
  { to: "/metas", label: "Metas", icon: "goals" },
];

// Tempo para o conteúdo do app sumir antes de voltar ao login (ver .layout.is-leaving)
const LOGOUT_FADE_MS = 260;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Sidebar({ userEmail, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="brand">ATLAS</div>

      <nav className="nav">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className="nav-link">
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {userEmail && (
          <span className="user-email" title={userEmail}>
            {userEmail}
          </span>
        )}
        <button type="button" className="logout" onClick={onLogout}>
          <Icon name="logout" size={16} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}

// Cópia invisível da sidebar, usada pelo login para saber onde o logo fica em qualquer tamanho de tela
export function SidebarProbe({ probeRef }) {
  return (
    <div className="layout layout-probe" ref={probeRef} aria-hidden="true" inert>
      <Sidebar userEmail="" onLogout={() => {}} />
    </div>
  );
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userEmail, setUserEmail] = useState("");
  const [leaving, setLeaving] = useState(false);
  const logoutTimer = useRef(null);

  // Lido só na montagem: a entrada animada acontece uma vez, logo depois do login
  const [fromLogin] = useState(() => Boolean(location.state?.fromLoginTransition));

  useEffect(() => {
    // Tira o estado do histórico para a animação não repetir ao recarregar a página
    if (window.history.state?.usr) {
      window.history.replaceState({ ...window.history.state, usr: null }, "");
    }

    // Confirma com o backend que o token ainda vale (se não valer, o request volta pro login)
    request("/auth/dashboard")
      .then((data) => setUserEmail(data.email))
      .catch(() => {});

    return () => clearTimeout(logoutTimer.current);
  }, []);

  // Saída: o conteúdo some, sobra só o fundo e o logo; o login faz o resto (o card "encolhe" de volta)
  const handleLogout = () => {
    const animate = !prefersReducedMotion();
    const goToLogin = () => {
      clearToken();
      navigate("/", { replace: true, state: animate ? { fromLogout: true } : null });
    };

    if (!animate) return goToLogin();
    setLeaving(true);
    logoutTimer.current = setTimeout(goToLogin, LOGOUT_FADE_MS);
  };

  return (
    <div className={`layout ${fromLogin ? "enter-morph" : ""} ${leaving ? "is-leaving" : ""}`}>
      <Sidebar userEmail={userEmail} onLogout={handleLogout} />

      <main className="main">
        {/* key faz cada página reiniciar a animação de entrada */}
        <div className="page" key={location.pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AppLayout;
