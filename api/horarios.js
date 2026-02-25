export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { especialidad } = req.query;

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
}
