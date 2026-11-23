import { z } from 'zod';

export const alternativaSchema = z.object({
  letra: z.string().regex(/^[A-J]$/, 'Letra deve ser de A a J'),
  texto: z.string().trim().min(1),
  correta: z.boolean().default(false),
});

export const questaoInputSchema = z.object({
  enunciado: z.string().trim().min(1),
  idTema: z.number().int().positive().nullable().optional(),
  idDificuldade: z.number().int().min(1).max(3).nullable().optional(),
  alternativas: z.array(alternativaSchema).max(10).default([])
    .refine(a => new Set(a.map(x => x.letra)).size === a.length, 'Letras repetidas')
    .refine(a => a.filter(x => x.correta).length <= 1, 'Marque apenas uma alternativa correta'),
});

export type QuestaoInput = z.infer<typeof questaoInputSchema>;
