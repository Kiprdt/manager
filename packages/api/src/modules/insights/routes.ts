import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { InsightsService } from './service';

const AnalyzeSchema = z.object({ question: z.string().max(500).optional() });

const insightsRoutes: FastifyPluginAsync = async (server) => {
  const svc = new InsightsService(server.prisma);

  // Снимок данных — можно забрать и отправить в свой LLM
  server.get('/snapshot', async () => svc.buildSnapshot());

  // Анализ через настроенный LLM (env LLM_API_KEY/LLM_API_URL/LLM_MODEL)
  server.post('/analyze', async (req) => {
    const { question } = AnalyzeSchema.parse(req.body ?? {});
    return svc.analyze(question);
  });
};

export default insightsRoutes;
