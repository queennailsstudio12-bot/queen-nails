export const studio = {
  name: 'Queen Nails Studio · by Sofía',
  tagline: 'Tus uñas merecen sentirse como una reina.',
  location: 'Alfonso López, Usme – Bogotá D. C.',
  timezone: 'America/Bogota',
  services: [
    { id: 'manicure', name: 'Manicure y semipermanente', minutes: 60 },
    { id: 'acrilicas', name: 'Uñas acrílicas', minutes: 60 },
    { id: 'polygel', name: 'Uñas en polygel', minutes: 60 },
    { id: 'fortalecimiento', name: 'Recubrimiento y fortalecimiento', minutes: 60 },
    { id: 'diseno', name: 'Diseño personalizado', minutes: 60 },
    { id: 'asesoria', name: 'Asesoría personalizada', minutes: 60 }
  ],
  // 0 = domingo, 1 = lunes, ... 6 = sábado. Último turno de una hora: 19:00.
  schedule: {
    1: [['09:00', '20:00']],
    2: [['09:00', '20:00']],
    3: [['09:00', '20:00']],
    4: [['09:00', '20:00']],
    5: [['09:00', '20:00']],
    6: [['09:00', '20:00']]
  },
  slotStepMinutes: 60,
  bookingWindowDays: 60
};
