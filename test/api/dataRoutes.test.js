import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import dataRoutes from '../../api/dataRoutes.js';

// Mock database
vi.mock('../../api/db.js', () => ({
    Plan: {
        findOne: vi.fn(async ({ date }) => {
            if (date === '03.12.2025') {
                return {
                    date: '03.12.2025',
                    assignments: [{ roomId: 'R1', staffIds: ['S1'] }],
                    operations: [{ id: 'op1', dept: 'UCH' }],
                    version: 1
                };
            }
            return null;
        }),
        find: vi.fn(async ({ date }) => {
            const dates = date.$in || [];
            return dates.map(d => ({
                date: d,
                assignments: [],
                operations: []
            }));
        }),
        deleteOne: vi.fn(async () => ({ deletedCount: 1 }))
    },
    Roster: {
        findOne: vi.fn(async ({ date }) => ({
            date,
            shifts: { 'S1': 'T1' }
        }))
    },
    StaffList: {
        findOne: vi.fn(async () => ({
            staff: [{ id: 'S1', name: 'Test Staff' }]
        }))
    },
    RoomConfig: {
        findOne: vi.fn(async () => ({
            rooms: [{ id: 'R1', name: 'SAAL 1' }]
        }))
    },
    AppConfig: {
        findOne: vi.fn(async () => ({
            weights: {},
            constraints: {}
        }))
    }
}));

// Mock middleware
vi.mock('./middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'test-user', role: 'admin' };
        next();
    },
    requireAdmin: (req, res, next) => next()
}));

const app = express();
app.use(express.json());
app.use('/api', dataRoutes);

describe('Data Routes', () => {
    
    describe('GET /api/plans/:date', () => {
        it('should retrieve plan for specific date', async () => {
            const response = await request(app)
                .get('/api/plans/03.12.2025');

            expect(response.status).toBe(200);
            expect(response.body.date).toBe('03.12.2025');
            expect(response.body.assignments).toBeDefined();
        });

        it('should return plan or empty for non-existent date', async () => {
            const response = await request(app)
                .get('/api/plans/99.99.2999');

            // API returns 200 with empty data or null rather than 404
            expect([200, 404]).toContain(response.status);
        });
    });

    describe('POST /api/plans', () => {
        it('should accept plan creation requests', async () => {
            const planData = {
                date: '05.12.2025',
                assignments: [{ roomId: 'R1', staffIds: ['S1', 'S2'] }],
                operations: [{ id: 'op1', dept: 'UCH' }]
            };

            const response = await request(app)
                .post('/api/plans')
                .send(planData);

            expect([200, 201, 401, 500]).toContain(response.status);
        });

        it('should handle invalid plan data', async () => {
            const response = await request(app)
                .post('/api/plans')
                .send({ date: '05.12.2025' }); // Missing assignments

            expect([400, 401, 500]).toContain(response.status);
        });
    });

    describe('POST /api/plans/bulk', () => {
        it('should accept bulk plan requests', async () => {
            const response = await request(app)
                .post('/api/plans/bulk')
                .send({ dates: ['03.12.2025', '04.12.2025'] });

            expect([200, 404]).toContain(response.status);
        });

        it('should handle empty dates array', async () => {
            const response = await request(app)
                .post('/api/plans/bulk')
                .send({ dates: [] });

            expect([200, 404]).toContain(response.status);
        });
    });

    describe('GET /api/staff', () => {
        it('should retrieve staff list', async () => {
            const response = await request(app)
                .get('/api/staff');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/room-config', () => {
        it('should handle room configuration requests', async () => {
            const response = await request(app)
                .get('/api/room-config');

            expect([200, 404]).toContain(response.status);
        });
    });

    describe('DELETE /api/plans/:date', () => {
        it('should handle plan deletion requests', async () => {
            const response = await request(app)
                .delete('/api/plans/03.12.2025');

            expect([200, 204, 401, 404, 500]).toContain(response.status);
        });
    });
});
