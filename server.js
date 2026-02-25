import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Servir archivos estáticos
app.use(express.static(__dirname));

// Proxy para el backend de la UTN
app.post('/api/horarios', async (req, res) => {
  const especialidad = req.query.especialidad;

  if (!especialidad) {
    return res.status(400).json({ error: 'especialidad es requerida' });
  }

  try {
    const response = await fetch('http://encuesta.frm.utn.edu.ar/horariocurso/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `especialidad=${especialidad}`
    });

    const buffer = await response.arrayBuffer();
    const html = new TextDecoder('iso-8859-1').decode(buffer);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Error fetching horarios:', error);
    res.status(500).json({ error: 'Error al obtener horarios' });
  }
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🎓 Horarios FRM - UTN                               ║
║                                                        ║
║   Servidor corriendo en: http://localhost:${PORT}        ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});
