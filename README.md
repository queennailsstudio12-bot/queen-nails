# Queen Nails Studio · Sistema de reservas y gestión

Sistema completo para Queen Nails Studio · by Sofía. Es **gratis**: usa Supabase (base de datos) y GitHub Pages (publicación).

| Página | Para quién | Qué hace |
|---|---|---|
| `index.html` | Clientas | Ver servicios y precios, reservar uno o varios servicios, reservar en grupo (2 a 6 personas), confirmar por WhatsApp, agregar a Google Calendar o .ics. Con su **enlace personal** (`?t=…`) pueden confirmar, cambiar de horario o cancelar. |
| `agenda.html` | Sofía (con contraseña) | **Agenda** (día con huecos libres, semana, por confirmar, recordatorios de mañana por WhatsApp, aviso al llegar una reserva) · **Caja** (cobrar servicios y productos, descuentos, propinas, pagos mixtos, abonos, comprobante, caja del día con apertura y cierre, gastos, ventas y anulaciones) · **Clientas** (ficha, historial, registros técnicos, cumpleaños) · **Reportes** (ventas, utilidad, servicios, productos, métodos de pago, mejores clientas, exportar a Excel) · **Más** (servicios y precios, horario, descansos, equipo y comisiones, inventario, gastos fijos, pagos a profesionales, configuración, enlace y QR, PIN, respaldo). Se puede instalar en el celular como app. |

## Puesta en marcha (una sola vez, unos 20 minutos)

### 1. Base de datos en Supabase
1. Crea una cuenta gratis en [supabase.com](https://supabase.com) con el correo del estudio y crea un proyecto nuevo. Región sugerida: *East US* o *São Paulo*.
2. Ve a **SQL Editor → New query**, pega todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y presiona **Run**. Esto crea las tablas, las reglas de seguridad, el horario (lunes a sábado de 9:00 a 20:00), a Sofía y los 6 servicios.
3. Ve a **Authentication → Users → Add user → Create new user**. Escribe el correo y la contraseña con los que Sofía entrará al panel y marca *Auto Confirm User*.
4. Vuelve al **SQL Editor** y ejecuta esto, cambiando el correo:
   ```sql
   insert into admins (user_id) select id from auth.users where email = 'queennailsstudio12@gmail.com';
   ```
5. **Importante para la seguridad:** en **Authentication → Sign In / Providers**, desactiva *Allow new users to sign up*. Así nadie más puede crear cuentas.
6. En **Project Settings → API** copia el *Project URL* y la clave *anon / publishable*.

### 2. Conectar las páginas
Abre [`config.js`](config.js) y reemplaza los dos valores:
```js
SUPABASE_URL: 'https://xxxxx.supabase.co',
SUPABASE_KEY: 'eyJ...'   // la clave anon/publishable: es pública, no es secreta
```

### 3. Publicar en GitHub Pages
1. Crea un repositorio en GitHub (por ejemplo `queen-nails`) y sube los archivos del proyecto. No subas `node_modules/`.
2. En el repositorio entra a **Settings → Pages**, elige *Deploy from a branch*, rama `main` y carpeta `/ (root)`.
3. En 1 o 2 minutos quedarán publicadas:
   - Reservas: `https://TU-USUARIO.github.io/queen-nails/`
   - Panel: `https://TU-USUARIO.github.io/queen-nails/agenda.html`
4. En Supabase, en **Authentication → URL Configuration**, pon como *Site URL* la dirección del panel. Así funciona "Olvidé mi contraseña".

### 4. Primeros ajustes en el panel
Entra a `agenda.html` y ve a **Más**:
- **Servicios y precios:** escribe los precios y las duraciones reales. Todos empiezan en 60 minutos y sin precio.
- **Horario de atención:** revísalo y agrega la pausa de almuerzo si la hay.
- **PIN de seguridad:** opcional, protege reportes y pagos.
- **Enlace y código QR:** copia el enlace para Instagram y WhatsApp.
- **Instalar como app** en el celular de Sofía.
- Haz una reserva de prueba desde la página pública, confírmala en el panel y luego cancélala.

## Cómo funciona
- **Sin choques de horario.** La base de datos rechaza dos citas que se crucen, aunque dos clientas reserven en el mismo segundo.
- **Reservas en línea.** Quedan *por confirmar* y Sofía las confirma desde el panel, con el mensaje de WhatsApp ya escrito. En *Configuración de reservas* se puede activar la confirmación automática.
- **Reglas configurables:** cuántos días adelante se puede reservar (30), anticipación mínima (60 min), hasta cuántas horas antes la clienta puede cancelar o cambiar (3 h), máximo de citas activas por celular (3), intervalo entre horas ofrecidas (30 min).
- **Seguridad.** Las clientas solo usan funciones públicas: ver disponibilidad, reservar y gestionar su cita con su enlace. No pueden leer datos de otras clientas. Todo lo demás exige la sesión de la dueña.
- **WhatsApp:** 322 867 6258 (se cambia en *Configuración de reservas*).

## Limitaciones
- Los mensajes de WhatsApp no se envían solos. El panel abre WhatsApp con el texto listo y Sofía toca enviar. El envío automático requiere la API de WhatsApp Business, que es de pago.
- Los avisos de reservas nuevas llegan mientras el panel está abierto (pestaña o app instalada).
- El plan gratuito de Supabase **pausa el proyecto tras 7 días sin uso** y **no guarda copias automáticas**. Con reservas o uso del panel no se pausa. Descarga un respaldo semanal en *Más → Respaldo*.

## Desarrollo y pruebas
```bash
npm install
npm test                    # prueba la base de datos completa en un Postgres local
node tests/dev-server.mjs   # simula Supabase con datos de ejemplo
                            # http://localhost:8787  y  /agenda.html (duena@demo.co / demo1234)
```

`legacy/` guarda los prototipos anteriores (Node.js y Google Apps Script). No se usan.
