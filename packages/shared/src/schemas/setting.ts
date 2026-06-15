import { z } from 'zod';

export const SettingSchema = z.object({
  telegramBotToken: z.string().nullable(),
  telegramChatId: z.string().nullable(),
  telegramEnabled: z.boolean(),
  llmApiKey: z.string().nullable(),
  llmBaseUrl: z.string().nullable(),
  llmModel: z.string().nullable(),
  proxyUrl: z.string().nullable(),
});
export type Setting = z.infer<typeof SettingSchema>;

export const UpdateSettingSchema = z.object({
  telegramBotToken: z.string().optional().nullable(),
  telegramChatId: z.string().optional().nullable(),
  telegramEnabled: z.boolean().optional(),
  llmApiKey: z.string().optional().nullable(),
  llmBaseUrl: z.string().optional().nullable(),
  llmModel: z.string().optional().nullable(),
  proxyUrl: z.string().optional().nullable(),
});
export type UpdateSettingDto = z.infer<typeof UpdateSettingSchema>;
