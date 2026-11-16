import { z } from 'zod';

export const alternativaSchema = z.object({
  letra: z.string().regex(/^[A-J]$/, 'Letra deve ser de A a J'),
  texto: z.string(),
  correta: z.boolean().default(false),
});

export const questaoInputSchema = z.object({
  enunciado: z.string(),
  idTema: z.number().int().positive().nullable().optional(),
  idDificuldade: z.number().int().min(1).max(3).nullable().optional(),
  alternativas: z.array(alternativaSchema).default([]),
});

export type QuestaoInput = z.infer<typeof questaoInputSchema>;
