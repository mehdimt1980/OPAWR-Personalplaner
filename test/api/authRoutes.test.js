import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../../api/authRoutes.js';

// Mock database
vi.mock('../../api/db.js', () => {
    const mockUser = {
        _id: 'test-user-id',
        username: 'testuser',
        passwordHash: '$2a$10$dummyhash', // bcrypt hash simulation
        role: 'admin',
        mustChangePassword: false,
        save: vi.fn()
    };

    return {
        User: {
            findOne: vi.fn(async ({ username }) => {
                if (username === 'testuser') return mockUser;
                return null;
            }),
            countDocuments: vi.fn(async () => 1)
        }
    };
});

// Mock bcrypt
vi.mock('bcryptjs', () => ({
    default: {
        compare: vi.fn(async (password, hash) => password === 'correctpass'),
        genSalt: vi.fn(async () => 'salt'),
        hash: vi.fn(async (password) => `hashed_${password}`)
    }
}));

const app = express();
app.use(express.json());
app.use('/api', authRoutes);

describe('Auth Routes', () => {
    
    describe('POST /api/auth/login', () => {
        it('should login with valid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'testuser', password: 'correctpass' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('accessToken');
            expect(response.body.user.username).toBe('testuser');
        });

        it('should reject invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'testuser', password: 'wrongpass' });

            expect(response.status).toBe(401);
        });

        it('should reject non-existent user', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'nonexistent', password: 'anypass' });

            expect(response.status).toBe(401);
        });

        it('should require username and password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ username: 'testuser' });

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/auth/change-password', () => {
        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/auth/change-password')
                .send({ newPassword: 'newpass123' });

            expect(response.status).toBe(401);
        });
    });

    describe('Edge Cases', () => {
        it('should handle missing request body', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({});

            expect(response.status).toBe(401);
        });

        it('should handle malformed JSON', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .set('Content-Type', 'application/json')
                .send('invalid-json');

            expect(response.status).toBe(400);
        });
    });
});
