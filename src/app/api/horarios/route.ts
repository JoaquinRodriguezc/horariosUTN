import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const especialidad = searchParams.get('especialidad');

  if (!especialidad) {
    return NextResponse.json({ error: 'especialidad es requerida' }, { status: 400 });
  }

  try {
    const response = await fetch('http://encuesta.frm.utn.edu.ar/horariocurso/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `especialidad=${especialidad}`,
    });

    const buffer = await response.arrayBuffer();
    const html = new TextDecoder('iso-8859-1').decode(buffer);

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error fetching horarios:', error);
    return NextResponse.json({ error: 'Error al obtener horarios' }, { status: 500 });
  }
}
