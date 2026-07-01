/**
 * Autenticación Firebase (Email/Password) para el dashboard en Pages.
 */
(function () {
  let firebaseApp = null;
  let auth = null;

  async function loadFirebaseConfig() {
    try {
      const res = await fetch("data/firebase.json?" + Date.now());
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function showLogin() {
    document.getElementById("login-gate")?.classList.remove("hidden");
    document.getElementById("app-shell")?.classList.add("hidden");
    document.body.classList.add("locked");
  }

  function showApp() {
    document.getElementById("login-gate")?.classList.add("hidden");
    document.getElementById("app-shell")?.classList.remove("hidden");
    document.body.classList.remove("locked");
    if (typeof window.initDashboard === "function") {
      window.initDashboard();
    }
  }

  function setLoginError(msg) {
    const el = document.getElementById("login-error");
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }

  async function initFirebase() {
    if (firebaseApp) return true;
    const cfg = await loadFirebaseConfig();
    if (!cfg?.apiKey || !cfg?.projectId) {
      setLoginError(
        "Falta data/firebase.json. Configura Firebase y vuelve a desplegar Pages."
      );
      showLogin();
      return false;
    }

    firebaseApp = firebase.initializeApp({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      appId: cfg.appId || undefined,
    });
    auth = firebase.auth();
    window._firebaseConfig = cfg;
    window._finDb = new window.FinDatabase(firebase);
    return true;
  }

  async function onSignedIn(user) {
    window._finDb.startSync();
    showApp();
  }

  async function tryLogin(email, password) {
    if (!(await initFirebase())) return;
    try {
      await auth.signInWithEmailAndPassword(email.trim(), password);
      setLoginError("");
    } catch (err) {
      setLoginError(err.message || "No se pudo iniciar sesión.");
    }
  }

  async function initAuth() {
    const ok = await initFirebase();
    if (!ok) return;

    const cfg = window._firebaseConfig || {};
    const emailInput = document.getElementById("login-email");
    if (emailInput && cfg.authEmail) {
      emailInput.value = cfg.authEmail;
    }

    auth.onAuthStateChanged((user) => {
      if (user) {
        onSignedIn(user);
      } else {
        if (window._unsubFinDb) {
          window._unsubFinDb();
          window._unsubFinDb = null;
        }
        window._finDb?.stopSync();
        showLogin();
      }
    });
  }

  window.getFinDb = function () {
    if (!window._finDb) throw new Error("Firestore no inicializado.");
    return window._finDb;
  };

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("login-form");
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email")?.value || "";
      const pwd = document.getElementById("login-password")?.value || "";
      if (!email || !pwd) {
        setLoginError("Escribe email y contraseña de Firebase.");
        return;
      }
      await tryLogin(email, pwd);
    });
    initAuth();
  });
})();
