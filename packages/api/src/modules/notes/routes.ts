import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { extname, join } from 'node:path';
import { CreateNoteSchema, UpdateNoteSchema, NoteQuerySchema } from '@life-app/shared';
import { NoteService } from './service';

export const UPLOAD_DIR = join(process.cwd(), 'uploads');

const noteRoutes: FastifyPluginAsync = async (server) => {
  const svc = new NoteService(server.prisma);

  server.get('/', async (req) => svc.list(NoteQuerySchema.parse(req.query)));

  server.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const n = await svc.getById(req.params.id);
    return n ?? reply.status(404).send({ error: 'not found' });
  });

  server.post('/', async (req, reply) =>
    reply.status(201).send(await svc.create(CreateNoteSchema.parse(req.body))),
  );

  server.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const n = await svc.update(req.params.id, UpdateNoteSchema.parse(req.body));
    return n ?? reply.status(404).send({ error: 'not found' });
  });

  server.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const res = await svc.delete(req.params.id);
    if (!res) return reply.status(404).send({ error: 'not found' });
    await Promise.all(res.stored.map((f) => unlink(join(UPLOAD_DIR, f)).catch(() => {})));
    return reply.status(204).send();
  });

  // Загрузка файла к заметке (multipart)
  server.post<{ Params: { id: string } }>('/:id/attachments', async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.status(400).send({ error: 'no file' });
    const storedAs = `${randomUUID()}${extname(file.filename)}`;
    let size = 0;
    file.file.on('data', (c: Buffer) => (size += c.length));
    await pipeline(file.file, createWriteStream(join(UPLOAD_DIR, storedAs)));
    const note = await svc.addAttachment(req.params.id, {
      filename: file.filename,
      storedAs,
      mimeType: file.mimetype,
      size,
    });
    if (!note) {
      await unlink(join(UPLOAD_DIR, storedAs)).catch(() => {});
      return reply.status(404).send({ error: 'note not found' });
    }
    return reply.status(201).send(note);
  });

  server.delete<{ Params: { attId: string } }>('/attachments/:attId', async (req, reply) => {
    const res = await svc.deleteAttachment(req.params.attId);
    if (!res) return reply.status(404).send({ error: 'not found' });
    await unlink(join(UPLOAD_DIR, res.storedAs)).catch(() => {});
    return reply.status(204).send();
  });
};

export default noteRoutes;
