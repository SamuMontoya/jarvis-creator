import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function testGroq() {
  console.log('Testing Groq API...\n');

  const idea = 'Crear una app de productividad para equipos remotos';
  
  const mockAnswers = [
    'Equipos de desarrollo y diseño que trabajan 100% remoto',
    'Falta de visibilidad del progreso, comunicación fragmentada, dificultad para coordinar husos horarios',
    'Slack (ruido), Trello/Jira (complejo), Notion (manual), standups diarios (ineficientes)',
    'Tasa de entrega a tiempo > 80%, tiempo de ciclo < 3 días, satisfacción equipo > 4/5',
    'Empresas B2B SaaS, 10-200 empleados, $15-30/usuario/mes',
  ];

  const prompt = `Genera exactamente 10 preguntas específicas y profundas para refinar esta idea de negocio.

IDEA: "${idea}"

RESPUESTAS PREVIAS:
1. ¿Quién usará esto y qué problema específico tiene? → ${mockAnswers[0]}
2. ¿Qué debe hacer tu software para resolver ese problema? → ${mockAnswers[1]}
3. ¿Qué soluciones ya existen y por qué no funcionan? → ${mockAnswers[2]}
4. ¿Cómo sabrás que tu producto tuvo éxito? (métricas) → ${mockAnswers[3]}
5. ¿Quién pagará y cuánto? → ${mockAnswers[4]}

INSTRUCCIONES:
- Las preguntas deben ser específicas, no genéricas
- Deben profundizar en aspectos no cubiertos aún
- Formato de respuesta OBLIGATORIO: JSON válido con clave "questions" que es un array de 10 objetos, cada uno con clave "pregunta"
- NO incluyas texto adicional, solo el JSON

EJEMPLO FORMATO:
{"questions": [{"pregunta": "..."}, {"pregunta": "..."}, ...]}`;

  console.log('Enviando prompt a Groq (modelo: mixtral-8x7b-32768)...\n');
  const startTime = Date.now();

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'Eres un experto en descubrimiento de productos y validación de ideas de negocio. Generas preguntas precisas en formato JSON estricto.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const elapsed = Date.now() - startTime;
    const response = completion.choices[0]?.message?.content;

    console.log(`Tiempo de respuesta: ${elapsed}ms\n`);
    console.log('Respuesta cruda:');
    console.log(response);
    console.log('\n---');

    if (!response) {
      console.error('ERROR: Respuesta vacía');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch (e) {
      console.error('ERROR: JSON inválido');
      console.error(e.message);
      return;
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      console.error('ERROR: Falta clave "questions" o no es array');
      return;
    }

    console.log(`\n✓ JSON válido`);
    console.log(`✓ Número de preguntas: ${parsed.questions.length}`);
    
    parsed.questions.forEach((q, i) => {
      if (q.pregunta && typeof q.pregunta === 'string') {
        console.log(`  ${i + 1}. ${q.pregunta.substring(0, 100)}${q.pregunta.length > 100 ? '...' : ''}`);
      } else {
        console.log(`  ${i + 1}. ERROR: formato inválido`);
      }
    });

    if (parsed.questions.length === 10) {
      console.log('\n✓ ÉXITO: Generó exactamente 10 preguntas');
    } else {
      console.log(`\n⚠ ADVERTENCIA: Se esperaban 10 preguntas, got ${parsed.questions.length}`);
    }

    if (elapsed < 10000) {
      console.log('✓ Tiempo de respuesta aceptable (< 10s)');
    } else {
      console.log('⚠ Tiempo de respuesta lento (> 10s)');
    }

  } catch (error) {
    console.error('ERROR en llamada a Groq:');
    console.error(error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testGroq();