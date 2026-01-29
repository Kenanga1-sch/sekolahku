import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { generateRegistrationNumber } from '../lib/spmb';
import { db } from '../db';
import { sql } from 'drizzle-orm';

vi.mock('../db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => [{ count: 41 }])
    }
}));

describe('SPMB Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generateRegistrationNumber', () => {
        it('should generate a formatted registration number', async () => {
            const year = new Date().getFullYear();
            const result = await generateRegistrationNumber();

            // Expected SPMB-YYYY-0042 since mock count is 41
            expect(result).toBe(`SPMB-${year}-0042`);
        });
    });
});
