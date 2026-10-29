import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { request } from "../api";
import { SidebarProbe } from "../components/AppLayout";

const COPY = {
  login: {
    subtitle: "Entre para continuar",
    submit: "Entrar",
    switchText: "Ainda não tem conta?",
    switchAction: "Criar conta",
  },
  register: {
    subtitle: "Crie sua conta",
    submit: "Cadastrar",
    switchText: "Já tem conta?",
    switchAction: "Entrar",
  },
};

// O card vira a tela (login) ou a tela vira o card (logout) (ver .morph-* no index.css).
// expand: tempo para o formulário sair antes do card crescer.
// O fim de cada sentido é o fim real do voo do logo (transitionend); o fallback só cobre o caso
// de o evento não chegar (aba em segundo plano, por exemplo).
const TIMELINE = { expand: 200, fallback: 1200 };

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Retângulo do texto (não da caixa): o h1 do card ocupa a largura toda com o texto centralizado
function textRect(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect();
}

// Mede o card, o logo do card e o logo da sidebar (pela cópia invisível), em qualquer tamanho de tela
function measureMorph(card, logo, sidebarBrand) {
  const c = card.getBoundingClientRect();
  const box = logo.getBoundingClientRect();
  const text = textRect(logo);
  const target = textRect(sidebarBrand);
  const fontSize = parseFloat(getComputedStyle(logo).fontSize);
  const scale = parseFloat(getComputedStyle(sidebarBrand).fontSize) / fontSize;
  const { clientWidth, clientHeight } = document.documentElement;

  // O texto passa um pouco da caixa (line-height 1); essa sobra também encolhe com a escala
  const overflowTop = text.top - box.top;

  // Em tela baixa (celular deitado) o card pode passar da tela; o clip-path não aceita valor negativo
  const edge = (value) => `${Math.max(0, value)}px`;

  return {
    surface: {
      "--t": edge(c.top),
      "--r": edge(clientWidth - c.right),
      "--b": edge(clientHeight - c.bottom),
      "--l": edge(c.left),
    },
    logo: {
      top: box.top,
      left: text.left,
      fontSize,
      "--s": scale,
      "--dx": `${target.left - text.left}px`,
      "--dy": `${target.top - overflowTop * scale - box.top}px`,
    },
  };
}

function Login() {
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Vindo do logout, a tela começa "como o app" (arrive) e encolhe até virar o card
  const [fromLogout] = useState(() => Boolean(location.state?.fromLogout) && !prefersReducedMotion());
  const [stage, setStage] = useState(fromLogout ? "arrive" : "idle");
  const [morph, setMorph] = useState(null);
  const timers = useRef([]);
  const cardRef = useRef(null);
  const logoRef = useRef(null);
  const probeRef = useRef(null);
  // O que fazer quando o logo terminar de voar (navegar ou mostrar o formulário)
  const onMorphEnd = useRef(null);

  const navigate = useNavigate();
  const copy = COPY[mode];

  const measure = () =>
    measureMorph(cardRef.current, logoRef.current, probeRef.current.querySelector(".brand"));

  // Cancela a animação pendente se a tela for desmontada no meio
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Roda o próximo passo uma única vez, seja pelo transitionend ou pelo fallback
  const finishMorph = () => {
    const next = onMorphEnd.current;
    onMorphEnd.current = null;
    next?.();
  };

  const whenMorphEnds = (next) => {
    onMorphEnd.current = next;
    timers.current.push(setTimeout(finishMorph, TIMELINE.fallback));
  };

  // Logout: mede antes da primeira pintura, para a tela já nascer igual ao app (fundo + logo no canto)
  useLayoutEffect(() => {
    if (!fromLogout) return;
    window.history.replaceState({ ...window.history.state, usr: null }, "");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- medir layout antes de pintar é o papel do useLayoutEffect
    setMorph(measure());

    // Dois frames: garante que o estado inicial foi pintado antes de começar a transição
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setStage("returning");
        whenMorphEnds(() => {
          setStage("idle");
          setMorph(null);
        });
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda só na montagem
  }, []);

  const playTransition = () => {
    const goToDashboard = (state) => navigate("/dashboard", { state });

    if (prefersReducedMotion()) {
      goToDashboard(null);
      return;
    }

    setMorph(measure());
    setStage("leaving");
    timers.current = [
      setTimeout(() => {
        setStage("expand");
        whenMorphEnds(() => goToDashboard({ fromLoginTransition: true }));
      }, TIMELINE.expand),
    ];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        await request("/auth/register", {
          method: "POST",
          body: { email, password },
        });
      }

      const data = await request("/auth/login", {
        method: "POST",
        body: { email, password },
      });

      localStorage.setItem("token", data.token);
      playTransition();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError("");
  };

  const busy = loading || stage !== "idle";

  return (
    <div className={`container stage-${stage} ${fromLogout ? "from-logout" : ""}`}>
      <form
        ref={cardRef}
        className={`card ${stage !== "idle" ? "is-morphing" : ""} ${error ? "has-error" : ""}`}
        onSubmit={handleSubmit}
        noValidate
      >
        <header className="card-header">
          <h1 className="logo-static" ref={logoRef}>
            ATLAS
          </h1>
          <p className="card-subtitle">{copy.subtitle}</p>
        </header>

        {error && (
          <p className="error" role="alert" key={error}>
            {error}
          </p>
        )}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            name="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "register" ? "Mínimo de 6 caracteres" : "••••••••"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            required
          />
        </label>

        <button
          type="submit"
          className="submit"
          disabled={busy || !email || !password}
          aria-busy={loading}
        >
          {loading ? <span className="spinner" aria-label="Carregando"></span> : copy.submit}
        </button>

        <p className="switch-mode">
          {copy.switchText}{" "}
          <button type="button" onClick={toggleMode} disabled={busy}>
            {copy.switchAction}
          </button>
        </p>
      </form>

      <SidebarProbe probeRef={probeRef} />

      {morph && (
        <>
          <div className="morph-surface" style={morph.surface} aria-hidden="true" />
          <p
            className="logo-static morph-logo"
            style={morph.logo}
            aria-hidden="true"
            onTransitionEnd={(e) => e.propertyName === "transform" && finishMorph()}
          >
            ATLAS
          </p>
        </>
      )}
    </div>
  );
}

export default Login;
