# Dashboard en GitHub Pages

El dashboard usa **Firebase Firestore** para datos en tiempo real. La configuración completa está en **[FIREBASE.md](../FIREBASE.md)** en la raíz del repo.

## Resumen

1. Crea proyecto Firebase (Auth email + Firestore).
2. Añade secrets `FIREBASE_*` y `PAGES_DEPLOY_TOKEN` en el repo privado.
3. Ejecuta el workflow **Deploy dashboard (Pages)**.
4. Abre la URL de Pages e inicia sesión.

Ya no se usa `DASHBOARD_PASSWORD` ni `repository_dispatch` para guardar gastos.
