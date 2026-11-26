# Queen Nails Studio · Agendamiento

Página de reservas para Queen Nails Studio · by Sofía. El diseño usa el logo original y sus colores rosa y dorado. Los seis servicios duran **60 minutos provisionalmente**.

## Ruta gratuita elegida

La versión final está en [`apps-script/`](apps-script/): **Google Apps Script** sirve la página y, con la cuenta `queennailsstudio12@gmail.com`, lee y crea eventos en su propio Google Calendar. No requiere servidor de pago, Supabase, dominio propio ni cuenta de servicio de Google Cloud. Google aplica [cuotas de Apps Script](https://developers.google.com/apps-script/guides/services/quotas); una cuenta Gmail tiene una cuota de 5.000 eventos creados al día, sujeta a cambios.

El proyecto anterior en Node.js sigue en la raíz como prototipo local. Para la publicación gratuita se usa `apps-script/`.

## Estado

La interfaz y la lógica para evitar reservas dobles están preparadas. El horario está configurado **lunes a sábado de 09:00 a 20:00**; con servicios de una hora, la última cita empieza a las **19:00**. No se ha publicado una URL de reservas: falta desplegar desde la cuenta de Google del estudio y verificar una cita real.

## Configurar el horario

El horario se define en `STUDIO.schedule` en [`apps-script/Code.gs`](apps-script/Code.gs). Los días son `0` domingo a `6` sábado. Configuración actual:

```js
schedule: {
  1: [['09:00', '20:00']],
  2: [['09:00', '20:00']],
  3: [['09:00', '20:00']],
  4: [['09:00', '20:00']],
  5: [['09:00', '20:00']],
  6: [['09:00', '20:00']]
}
```

Se pueden agregar varios bloques por día para dejar descansos, por ejemplo `[['09:00', '13:00'], ['14:00', '18:00']]`. Antes de guardar una reserva, el script vuelve a consultar el calendario dentro de un bloqueo compartido para impedir dos reservas simultáneas del mismo horario.

## Preparar la publicación

1. Ejecutar `node apps-script/build.mjs`. Esto genera `apps-script/dist/Code.gs`, `apps-script/dist/Index.html` y `apps-script/dist/appsscript.json`. La página final incluye el logo, estilos y código del navegador en un solo HTML.
2. Crear un proyecto de Apps Script con la cuenta del estudio en [script.google.com](https://script.google.com/). Subir los tres archivos generados. Se puede usar [clasp](https://developers.google.com/apps-script/guides/clasp) para subirlos sin copiar manualmente el HTML grande.
3. Fijar la zona horaria del proyecto en `America/Bogota` y autorizar el acceso a Calendar cuando Google lo solicite.
4. Desplegar como **Aplicación web**, con **Ejecutar como: yo** y **Quién tiene acceso: cualquiera**. Así las clientas abren el enlace sin iniciar sesión y el script escribe en el calendario del estudio. Ver [documentación oficial](https://developers.google.com/apps-script/guides/web).
5. Probar una reserva real de prueba, comprobar que aparece en Google Calendar y eliminarla antes de compartir el enlace a clientas.

La cuenta que despliega debe tener acceso de edición al calendario indicado en `STUDIO.calendarId`.

## Limitaciones del plan gratuito

Apps Script tiene cuotas y límites de ejecución que Google puede modificar. La página no envía mensajes automáticos por WhatsApp ni cobra anticipos. La confirmación se muestra en pantalla y la cita queda en Google Calendar.
