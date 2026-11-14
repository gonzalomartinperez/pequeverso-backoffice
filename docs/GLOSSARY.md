# Glossary

The interface is in Spanish (es-419, tú); code, docs and commits are in English. This table maps
the Spanish terms the owner sees to the English names used in code and docs. Add a row when a new
user-visible concept appears; the code name is the one in `src/`.

| Spanish (UI) | English (code, docs) | Meaning |
| --- | --- | --- |
| Estado (Estado del asistente) | dashboard (`/panel`) | The signed-in operations view of the shopping assistant. |
| Accesos | access (`/panel/accesos`) | Members with access, pending invitations and their management. |
| Cuenta (Tu cuenta) | account (`/panel/cuenta`) | The signed-in person's linked sign-in identities. |
| Actividad del sitio | analytics report (`/panel/analitica`) | Read-only site-activity aggregates; off by default. |
| Propietario | `owner` role | Can manage access; the first owner comes from `OWNER_EMAIL`. |
| Lectura | `viewer` role | Can read the panel; cannot change access. |
| Invitación | invitation | Single-use link for one provider-verified e-mail; expires after 48 h. |
| Quitar acceso | remove member | Deletes the member's account; its sessions go with it. |
| Revocar invitación | revoke invitation | Voids a pending invitation link. |
| Pendiente (invitación) | `pending` invitation state | Invitation not used yet and not expired. |
| Ejecuciones (Últimas ejecuciones) | `runs` | Assistant answer attempts recorded by the API. |
| Solicitudes | `windows[].runs` | Run outcomes in a time window: accepted, completed, failed, cancelled, interrupted, rejected. |
| Presupuesto | budget | Monthly and daily spend against the API's limits. |
| Con uso informado | confirmed spend | Cost from reported token usage and versioned prices; not the provider invoice. |
| Estimado | estimated spend | Unknown usage; the worst-case reservation is kept. |
| Pendiente (presupuesto) | pending spend | Reservations of runs still in progress. |
| Reserva | reservation | Amount held before a run so spend cannot exceed the limit. |
| Corte de seguridad mensual | monthly safety cutoff | Spend level at which the API stops answering. |
| Catálogo | catalog | The product snapshot the assistant answers from, with its freshness. |
| Instantánea empaquetada / remota | bundled / remote snapshot | Where the catalog snapshot comes from; the remote one does not verify a deployment. |
| Ventana de precios | price window | Validity window of the versioned model prices. |
| No disponible | unavailable | A value the API did not report; never shown as zero. |
| Datos sintéticos | synthetic (fixture) data | Data from the test provider or fixtures, always labelled. |
| Estado técnico | telemetry | Optional private process and service readings; not proof of provider availability. |
