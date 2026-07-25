import { z } from 'zod';

export const auditRequestSchema = z.object({
  url: z
    .string({ message: 'Please provide a valid HTTP or HTTPS URL.' })
    .min(1, 'Please provide a valid HTTP or HTTPS URL.')
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      },
      {
        message: 'Please provide a valid HTTP or HTTPS URL.',
      }
    ),
});

export type AuditRequest = z.infer<typeof auditRequestSchema>;

