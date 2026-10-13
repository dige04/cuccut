import { z } from 'zod';
import { ProtocolValidation as V } from './messages/protocol/protocol-validation.ts';

/** BCP 47 language tags, checked with `Intl.getCanonicalLocales`. Kept in its own module so that `ai-tool-schemas.ts` and `schemas.ts` do not import each other. */
export const languageTag = z
  .string()
  .min(1)
  .max(35)
  .refine((tag) => {
    try {
      return Intl.getCanonicalLocales(tag).length === 1;
    } catch {
      return false;
    }
  }, { error: () => V.languageTagInvalid().text });
