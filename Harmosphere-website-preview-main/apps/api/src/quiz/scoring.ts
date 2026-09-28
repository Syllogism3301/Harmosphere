import { BadRequestException } from '@nestjs/common';
import { Definition, Dimension, dimensions, profiles } from './definition';

export function scoreQuiz(def: Definition, answers: Record<string, number>) {
  if (Object.keys(answers).length !== def.questions.length || def.questions.some(q => !Number.isInteger(answers[q.id]) || answers[q.id] < 1 || answers[q.id] > 5)) throw new BadRequestException('QUIZ_INCOMPLETE');
  const scores = Object.fromEntries(dimensions.map(d => {
    const questions = def.questions.filter(q => q.dimension === d);
    return [d, Math.round(questions.reduce((sum, q) => sum + (answers[q.id] - 1), 0) / (questions.length * 4) * 100)];
  })) as Record<Dimension, number>;
  const ranking = [...dimensions].sort((a, b) => scores[b] - scores[a]);
  return { profile: ranking[0], scores, ranking, title: profiles[ranking[0]].title, summary: profiles[ranking[0]].summary, exercise: profiles[ranking[0]].exercise, scoringVersion: def.id };
}
