export const locales = ['en', 'pt-BR', 'es'] as const;
export type Locale = typeof locales[number];
export type Localized = Record<Locale, string>;
export const text = (en: string, pt: string, es: string): Localized => ({ en, 'pt-BR': pt, es });
export const dimensions = ['pulse', 'emotion', 'texture', 'discovery', 'focus'] as const;
export type Dimension = typeof dimensions[number];
export type Question = { id: string; dimension: Dimension; text: Localized };
export type Definition = { id: string; questions: Question[] };

// Editorial seed, not a validated personality or intelligence assessment.
// Never modify a published version: create v2 to change wording or scoring.
const groups: Array<[Dimension, Array<[string, string, string]>]> = [
  ['pulse', [
    ['A strong beat is the first thing I notice in a song.', 'Uma batida marcante é a primeira coisa que percebo numa música.', 'Un ritmo marcado es lo primero que noto en una canción.'],
    ['I enjoy music that makes me want to move.', 'Gosto de músicas que me dão vontade de me mexer.', 'Disfruto la música que me invita a moverme.'],
    ['I tap along to rhythms without thinking.', 'Acompanho ritmos com as mãos ou os pés sem perceber.', 'Sigo los ritmos con las manos o los pies sin pensarlo.'],
    ['An energetic track can change my whole afternoon.', 'Uma faixa animada pode mudar minha tarde inteira.', 'Una canción enérgica puede cambiar toda mi tarde.'],
    ['I listen closely to drums and percussion.', 'Presto atenção na bateria e na percussão.', 'Escucho con atención la batería y la percusión.'],
    ['I enjoy rhythmic surprises and syncopation.', 'Gosto de surpresas rítmicas e síncopes.', 'Disfruto las sorpresas rítmicas y las síncopas.'],
  ]],
  ['emotion', [
    ['A melody can bring back a vivid memory.', 'Uma melodia pode trazer uma lembrança vívida.', 'Una melodía puede traerme un recuerdo vívido.'],
    ['I choose songs that match how I feel.', 'Escolho músicas que combinam com o que sinto.', 'Elijo canciones que acompañan lo que siento.'],
    ['Expressive vocals matter more to me than perfect technique.', 'Uma voz expressiva me importa mais que uma técnica perfeita.', 'Una voz expresiva me importa más que una técnica perfecta.'],
    ['I enjoy music with a sense of longing.', 'Gosto de músicas que transmitem saudade.', 'Disfruto la música que transmite añoranza.'],
    ['I follow the emotional journey of a song.', 'Acompanho a trajetória emocional de uma música.', 'Sigo el recorrido emocional de una canción.'],
    ['A simple tune can move me deeply.', 'Uma melodia simples pode me emocionar profundamente.', 'Una melodía sencilla puede emocionarme profundamente.'],
  ]],
  ['texture', [
    ['I notice small details in the background of a recording.', 'Percebo pequenos detalhes no fundo de uma gravação.', 'Noto pequeños detalles en el fondo de una grabación.'],
    ['I enjoy layered instruments and rich arrangements.', 'Gosto de instrumentos sobrepostos e arranjos ricos.', 'Disfruto los instrumentos en capas y los arreglos ricos.'],
    ['The sound of an instrument can fascinate me on its own.', 'O som de um instrumento pode me fascinar por si só.', 'El sonido de un instrumento puede fascinarme por sí solo.'],
    ['I like spacious, atmospheric productions.', 'Gosto de produções espaçosas e atmosféricas.', 'Me gustan las producciones amplias y atmosféricas.'],
    ['I listen again to discover sounds I missed.', 'Ouço novamente para descobrir sons que não percebi.', 'Vuelvo a escuchar para descubrir sonidos que no noté.'],
    ['The way a song is produced shapes my experience.', 'A forma como uma música é produzida influencia minha experiência.', 'La producción de una canción influye en mi experiencia.'],
  ]],
  ['discovery', [
    ['I actively look for artists I have never heard.', 'Procuro ativamente artistas que nunca ouvi.', 'Busco activamente artistas que nunca he escuchado.'],
    ['Unusual song structures keep me interested.', 'Estruturas musicais incomuns mantêm meu interesse.', 'Las estructuras musicales inusuales mantienen mi interés.'],
    ['I enjoy exploring music from unfamiliar traditions.', 'Gosto de explorar músicas de tradições que não conheço.', 'Disfruto explorar música de tradiciones que no conozco.'],
    ['I give challenging music more than one listen.', 'Dou mais de uma chance a músicas desafiadoras.', 'Doy más de una oportunidad a la música desafiante.'],
    ['I like artists who blend very different genres.', 'Gosto de artistas que misturam gêneros bem diferentes.', 'Me gustan los artistas que mezclan géneros muy diferentes.'],
    ['I welcome unexpected changes in a piece.', 'Gosto de mudanças inesperadas numa composição.', 'Disfruto los cambios inesperados en una composición.'],
  ]],
  ['focus', [
    ['I use music to create a calm space.', 'Uso a música para criar um espaço tranquilo.', 'Uso la música para crear un espacio tranquilo.'],
    ['I enjoy slow musical development.', 'Gosto de um desenvolvimento musical lento.', 'Disfruto el desarrollo musical lento.'],
    ['Repetition in music can help me concentrate.', 'A repetição na música pode me ajudar a concentrar.', 'La repetición en la música puede ayudarme a concentrarme.'],
    ['I appreciate silence and pauses in a piece.', 'Aprecio o silêncio e as pausas numa composição.', 'Aprecio el silencio y las pausas en una composición.'],
    ['I enjoy listening to an album without multitasking.', 'Gosto de ouvir um álbum sem fazer outras coisas.', 'Disfruto escuchar un álbum sin hacer otras cosas.'],
    ['Gentle instrumental music is part of my routine.', 'Música instrumental suave faz parte da minha rotina.', 'La música instrumental suave forma parte de mi rutina.'],
  ]],
];
export const definition: Definition = {
  id: 'musical-compass-v1',
  questions: groups.flatMap(([dimension, items], group) => items.map((words, i) => ({ id: `q${group * 6 + i + 1}`, dimension, text: text(...words) }))),
};
export const profiles: Record<Dimension, { title: Localized; summary: Localized; exercise: Localized }> = {
  pulse: { title: text('The Rhythm Seeker', 'Explorador de ritmos', 'Explorador de ritmos'), summary: text('Your answers lean toward movement, groove and rhythmic detail.', 'Suas respostas apontam para movimento, groove e detalhes rítmicos.', 'Tus respuestas se inclinan hacia el movimiento, el groove y los detalles rítmicos.'), exercise: text('Listen to a familiar track and follow only its percussion. Then compare a live version.', 'Ouça uma faixa conhecida acompanhando apenas a percussão. Depois compare com uma versão ao vivo.', 'Escucha una canción conocida siguiendo solo la percusión. Luego compara una versión en vivo.') },
  emotion: { title: text('The Story Listener', 'Ouvinte de histórias', 'Oyente de historias'), summary: text('Melody, expression and musical memories stand out in your answers.', 'Melodia, expressão e memórias musicais se destacam nas suas respostas.', 'La melodía, la expresión y los recuerdos musicales destacan en tus respuestas.'), exercise: text('Choose two interpretations of the same melody. Notice how phrasing changes the feeling.', 'Escolha duas interpretações da mesma melodia. Perceba como o fraseado muda a sensação.', 'Elige dos interpretaciones de la misma melodía. Observa cómo el fraseo cambia la sensación.') },
  texture: { title: text('The Sound Architect', 'Arquiteto dos sons', 'Arquitecto del sonido'), summary: text('You are drawn to layers, timbre and the spaces inside a recording.', 'Você se interessa por camadas, timbres e pelos espaços de uma gravação.', 'Te atraen las capas, los timbres y los espacios de una grabación.'), exercise: text('Listen with headphones at a comfortable level. Map the instruments from left to right.', 'Ouça com fones em volume confortável. Mapeie os instrumentos da esquerda para a direita.', 'Escucha con auriculares a un volumen cómodo. Ubica los instrumentos de izquierda a derecha.') },
  discovery: { title: text('The Open Explorer', 'Explorador de possibilidades', 'Explorador de posibilidades'), summary: text('Curiosity and unexpected musical paths feature strongly in your answers.', 'Curiosidade e caminhos musicais inesperados aparecem nas suas respostas.', 'La curiosidad y los caminos musicales inesperados destacan en tus respuestas.'), exercise: text('Explore one unfamiliar tradition. Learn the context of a piece before listening again.', 'Explore uma tradição desconhecida. Conheça o contexto de uma peça antes de ouvi-la novamente.', 'Explora una tradición desconocida. Conoce el contexto de una pieza antes de volver a escucharla.') },
  focus: { title: text('The Quiet Observer', 'Observador tranquilo', 'Observador tranquilo'), summary: text('You value space, patience and attentive listening.', 'Você valoriza espaço, paciência e escuta atenta.', 'Valoras el espacio, la paciencia y la escucha atenta.'), exercise: text('Set aside ten minutes for one instrumental piece. Notice its pauses as carefully as its notes.', 'Reserve dez minutos para uma peça instrumental. Observe suas pausas com o mesmo cuidado das notas.', 'Reserva diez minutos para una pieza instrumental. Observa sus pausas con el mismo cuidado que sus notas.') },
};
