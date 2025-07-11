jest.mock('@/lib/prisma', () => ({
  prisma: {
    report: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
    },
  },
}));

import { POST } from '../../app/api/signalement/route';

describe('POST /api/signalement', () => {
  it('refuse un signalement sans motif', async () => {
    const req = { json: async () => ({ message: 'test' }) } as any;
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.message).toBe('Entrée invalide');
    expect(data.details).toBeDefined();
  });

  it('accepte un signalement valide', async () => {
    const req = { json: async () => ({ motif: 'bug', message: 'test' }) } as any;
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });
}); 